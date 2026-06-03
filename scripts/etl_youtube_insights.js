import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ytSearch from 'yt-search';
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
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Función auxiliar para reintentar llamadas a Gemini en caso de error 503 o 429
async function generateContentWithRetry(prompt, retries = 10, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err) {
      const errMsg = err.message || '';
      const isDailyLimit = errMsg.includes('GenerateRequestsPerDay') || errMsg.includes('RequestsPerDay') || errMsg.includes('limit: 20');
      
      if (isDailyLimit) {
        // Si es límite diario, no tiene sentido reintentar. Lanzamos el error inmediatamente.
        console.error("\n[Gemini API] Límite diario de peticiones alcanzado (20/día).");
        throw err;
      }

      const isTemporary = err.status === 503 || err.status === 429 || 
                          err.message?.includes('503') || err.message?.includes('429') ||
                          err.message?.includes('Service Unavailable') || err.message?.includes('Too Many Requests');
      
      if (isTemporary && i < retries - 1) {
        console.warn(`[Gemini API] Ocupado o límite de cuota (Intento ${i + 1}/${retries}). Reintentando en ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Backoff exponencial
        continue;
      }
      throw err;
    }
  }
}


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

  const unanalyzedChannels = [];
  let quotaExceededAborted = false;

  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i];
    
    if (quotaExceededAborted) {
      unanalyzedChannels.push(channel.channel_name);
      continue;
    }

    console.log(`\nProcesando canal (${i + 1}/${channels.length}): ${channel.channel_name} (${channel.channel_id})`);
    try {
      // 2. Obtener videos buscando el nombre del canal
      const searchResult = await ytSearch(channel.channel_name);
      
      // Filtramos para asegurarnos de que el video sea realmente del canal
      const channelVideos = searchResult.videos.filter(v => 
        v.author.name.toLowerCase().includes(channel.channel_name.toLowerCase()) ||
        channel.channel_name.toLowerCase().includes(v.author.name.toLowerCase())
      );

      if (channelVideos.length === 0) {
        console.log("No se encontraron videos recientes para este canal en la búsqueda.");
        continue;
      }

      // Tomamos el último video (yt-search los ordena por relevancia/fecha generalmente)
      const latestVideo = channelVideos[0];
      const videoId = latestVideo.videoId;
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
Transcripción: ${transcriptText}`;

      let textResponse = "";
      try {
         const rawResponse = await generateContentWithRetry(prompt);
         textResponse = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
      } catch (geminiErr) {
         console.error(`Error definitivo de Gemini al procesar el canal ${channel.channel_name}:`, geminiErr.message);
         
         // Si el error es específicamente por cuota excedida (429), abortamos la cola
         if (geminiErr.status === 429 || geminiErr.message?.includes('429') || geminiErr.message?.includes('Quota exceeded')) {
            console.error("\n[CRÍTICO] Se ha excedido la cuota diaria o de minutos de la API de Gemini.");
            console.error("Deteniendo el proceso ETL para evitar bloqueos adicionales...");
            quotaExceededAborted = true;
            unanalyzedChannels.push(channel.channel_name);
            continue;
         }
         
         continue; // Si es otro error, saltamos al siguiente
      }
      
      console.log("Respuesta de Gemini recibida.");

      let sector = "N/A";
      let summary = "No se pudo extraer el resumen.";
      let tickerInsights = [];
      let tickersMentioned = "N/A";

      try {
         const parsed = JSON.parse(textResponse);
         sector = parsed.sector || "N/A";
         summary = parsed.resumen || "N/A";
         tickerInsights = Array.isArray(parsed.ticker_insights) ? parsed.ticker_insights : [];
         
         if (tickerInsights.length > 0) {
            tickersMentioned = tickerInsights.map(t => t.ticker).join(", ");
         }
      } catch (err) {
         console.error("Error parseando el JSON de Gemini:", err);
         summary = textResponse; // Fallback
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
          tickers_mentioned: tickersMentioned,
          sector: sector,
          thesis_summary: summary,
          ticker_insights: tickerInsights,
          published_at: new Date().toISOString() // yt-search no provee fecha exacta ISO, usamos la actual
        }]);

      if (insertError) {
         console.error("Error insertando en base de datos:", insertError);
      } else {
         console.log("Procesamiento completado con éxito para el video.");
      }

      // Agregamos un delay de 6 segundos entre canales para no superar el límite de 15 Requests Per Minute (RPM) de la API gratuita
      if (i < channels.length - 1) {
         console.log("Esperando 6 segundos antes del siguiente canal para respetar la cuota RPM...");
         await new Promise(resolve => setTimeout(resolve, 6000));
      }

    } catch (err) {
       console.error(`Error procesando el canal ${channel.channel_name}:`, err);
    }
  }

  if (quotaExceededAborted) {
     console.log("\n=======================================================");
     console.log("[ETL ABORTADO POR CUOTA] Canales que NO se analizaron:");
     unanalyzedChannels.forEach(c => console.log(`- ${c}`));
     console.log("=======================================================");
  }

  console.log("\nProceso ETL finalizado.");
}

runETL();
