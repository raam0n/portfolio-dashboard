import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Configurar Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan variables de entorno para Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configurar Gemini
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  console.error("Falta la variable de entorno GEMINI_API_KEY.");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

const parser = new Parser();

async function runETL() {
  console.log("Iniciando ETL de YouTube Insights...");

  // 1. Leer los canales
  const { data: channels, error: channelsError } = await supabase
    .from('tracked_channels')
    .select('*');

  if (channelsError) {
    console.error("Error obteniendo canales:", channelsError);
    return;
  }

  if (!channels || channels.length === 0) {
    console.log("No hay canales para procesar.");
    return;
  }

  for (const channel of channels) {
    console.log(`\nProcesando canal: ${channel.channel_name} (${channel.channel_id})`);
    try {
      // 2. Obtener videos por RSS
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channel_id}`;
      const feed = await parser.parseURL(feedUrl);
      
      if (!feed.items || feed.items.length === 0) {
        console.log("No se encontraron videos en el feed.");
        continue;
      }

      // Tomamos el último video
      const latestVideo = feed.items[0];
      const videoId = latestVideo.id.replace('yt:video:', '');
      console.log(`Último video: ${latestVideo.title} (ID: ${videoId})`);

      // 3. Verificar si el video ya existe en la DB
      const { data: existingVideo, error: existingError } = await supabase
        .from('youtube_video_logs')
        .select('video_id')
        .eq('video_id', videoId)
        .single();

      if (existingVideo) {
        console.log("El video ya fue procesado anteriormente. Haciendo skip.");
        continue;
      }

      // 4. Obtener transcripción
      console.log("Obteniendo transcripción...");
      let transcriptText = "";
      try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        transcriptText = transcript.map(t => t.text).join(' ');
      } catch (e) {
        console.error("Error obteniendo la transcripción, es posible que el video no tenga subtítulos:", e.message);
        continue; // Si no hay subs, saltamos
      }

      if (!transcriptText || transcriptText.trim().length === 0) {
         console.log("La transcripción está vacía.");
         continue;
      }

      // 5. Enviar al LLM
      console.log("Llamando a Gemini para resumir...");
      const prompt = `Lee la transcripción de este video financiero. Extrae los tickers mencionados, el sector principal del que hablan, y escribe un resumen cualitativo de 2 a 3 líneas con la tesis u opinión principal del autor. No uses formato JSON estricto para el resumen, redactalo de forma natural, pero por favor entrega los datos estructurados en tu respuesta separando: Tickers, Sector, Resumen. 
      Transcripción: ${transcriptText.substring(0, 30000)}`; // limitando el texto a un tamaño razonable

      const result = await model.generateContent(prompt);
      const llmResponse = await result.response;
      const textResponse = llmResponse.text();
      
      console.log("Respuesta de Gemini recibida.");

      // Parseamos la respuesta del LLM (heurística básica, ya que pedimos formato)
      // Extraemos Tickers, Sector y Resumen si vienen separados. Para simplificar, lo guardaremos así.
      let tickers = "No especificado";
      let sector = "No especificado";
      let summary = textResponse;

      const lines = textResponse.split('\n');
      for (const line of lines) {
         if (line.toLowerCase().startsWith('tickers:') || line.toLowerCase().startsWith('**tickers:**')) {
             tickers = line.replace(/(\*\*?)?[tT]ickers:(\*\*?)?/i, '').trim();
         }
         else if (line.toLowerCase().startsWith('sector:') || line.toLowerCase().startsWith('**sector:**')) {
             sector = line.replace(/(\*\*?)?[sS]ector:(\*\*?)?/i, '').trim();
         }
         else if (line.toLowerCase().startsWith('resumen:') || line.toLowerCase().startsWith('**resumen:**')) {
             summary = line.replace(/(\*\*?)?[rR]esumen:(\*\*?)?/i, '').trim();
         }
      }

      // 6. Insertar en la BD
      console.log("Guardando en la base de datos...");
      const { error: insertError } = await supabase
        .from('youtube_video_logs')
        .insert([{
          video_id: videoId,
          channel_id: channel.channel_id,
          channel_name: channel.channel_name,
          video_title: latestVideo.title,
          tickers_mentioned: tickers,
          sector: sector,
          thesis_summary: summary,
          published_at: latestVideo.pubDate
        }]);

      if (insertError) {
         console.error("Error insertando en base de datos:", insertError);
      } else {
         console.log("Procesamiento completado con éxito para el video.");
      }

    } catch (err) {
       console.error(`Error procesando el canal ${channel.channel_name}:`, err);
    }
  }

  console.log("\nProceso ETL finalizado.");
}

runETL();
