import { createClient } from '@supabase/supabase-js';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
    return res.status(500).json({ error: "Variables de entorno no configuradas correctamente." });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    const { data: channels, error: channelsError } = await supabase
      .from('tracked_channels')
      .select('*');

    if (channelsError) throw channelsError;

    let processedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const channel of channels || []) {
      try {
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channel_id}`;
        const feedRes = await fetch(feedUrl);
        if (!feedRes.ok) continue;
        const xmlText = await feedRes.text();

        const titleMatch = xmlText.match(/<entry>[\s\S]*?<title>(.*?)<\/title>/);
        const videoIdMatch = xmlText.match(/<entry>[\s\S]*?<yt:videoId>(.*?)<\/yt:videoId>/);

        if (!videoIdMatch || !videoIdMatch[1]) continue;

        const videoId = videoIdMatch[1];
        const videoTitle = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : 'Sin Título';

        // Check if video already exists
        const { data: existingVideo } = await supabase
          .from('youtube_video_logs')
          .select('video_id')
          .eq('video_id', videoId)
          .single();

        if (existingVideo) {
          skippedCount++;
          continue;
        }

        // Fetch transcript
        let transcriptText = "";
        try {
          const transcript = await YoutubeTranscript.fetchTranscript(videoId);
          transcriptText = transcript.map(t => t.text).join(' ');
        } catch (e) {
          skippedCount++;
          continue;
        }

        if (!transcriptText || transcriptText.trim().length === 0) {
          skippedCount++;
          continue;
        }

        // Summarize with Gemini
        const prompt = `Lee la transcripción de este video financiero. 
Extrae el sector principal del que hablan y escribe un resumen cualitativo general de 2 a 3 líneas con la tesis u opinión principal del autor sobre el mercado o el tema central.
Luego, para cada ticker (acción o empresa) mencionado en el video, extrae:
1. El símbolo del ticker (ej. NVDA).
2. La acción recomendada o el tono (Comprar, Vender, Mantener, u Observar).
3. El precio objetivo (target_price) o precio de entrada/salida sugerido (ej. $150). Si no se menciona, pon "N/A".
4. Un resumen corto de 1 a 2 líneas de lo que se dice ESPECÍFICAMENTE sobre ese ticker (cuándo comprar, por qué, riesgos, etc.).

Devuelve tu respuesta ÚNICAMENTE como un texto JSON válido con esta estructura exacta, sin comentarios, sin formato markdown:
{
  "sector": "Tecnología",
  "resumen": "Aquí va el resumen cualitativo general del video.",
  "ticker_insights": [
    {
      "ticker": "NVDA",
      "action": "Comprar",
      "target_price": "$150",
      "insight_summary": "El autor sugiere comprar NVIDIA en caídas debido al crecimiento de IA."
    }
  ]
}
Si no se mencionan tickers, devuelve un arreglo vacío [].
Transcripción: ${transcriptText.substring(0, 15000)}`;

        const geminiResult = await model.generateContent(prompt);
        const textResponse = (await geminiResult.response).text().replace(/```json/gi, '').replace(/```/g, '').trim();

        let sector = "Finanzas";
        let summary = "Resumen procesado.";
        let tickerInsights = [];
        let tickersMentioned = "N/A";

        try {
          const parsed = JSON.parse(textResponse);
          sector = parsed.sector || "Finanzas";
          summary = parsed.resumen || textResponse;
          tickerInsights = Array.isArray(parsed.ticker_insights) ? parsed.ticker_insights : [];
          if (tickerInsights.length > 0) {
            tickersMentioned = tickerInsights.map(t => t.ticker).join(", ");
          }
        } catch (err) {
          summary = textResponse;
        }

        // Insert into Supabase
        await supabase
          .from('youtube_video_logs')
          .insert([{
            video_id: videoId,
            channel_id: channel.channel_id,
            channel_name: channel.channel_name,
            video_title: videoTitle,
            tickers_mentioned: tickersMentioned,
            sector: sector,
            thesis_summary: summary,
            ticker_insights: tickerInsights,
            published_at: new Date().toISOString()
          }]);

        processedCount++;
        results.push({ channel: channel.channel_name, title: videoTitle });

      } catch (channelErr) {
        console.error(`Error en canal ${channel.channel_name}:`, channelErr);
      }
    }

    return res.status(200).json({
      success: true,
      processed: processedCount,
      skipped: skippedCount,
      results
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
