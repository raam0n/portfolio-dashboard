import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const DEBUG_MODE = true;
const LOGS_DIR = path.join(process.cwd(), 'logs');

if (DEBUG_MODE && !fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan variables de entorno para Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Gemini
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!geminiApiKey) {
  console.error("Falta la variable de entorno GEMINI_API_KEY o VITE_GEMINI_API_KEY.");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Helper para loguear uso
async function logApiUsageToSupabase(service_name, feature, endpoint_model, tokens_prompt, tokens_completion, status, error_message) {
  try {
    await supabase.from('api_usage_logs').insert([{
      service_name,
      feature,
      endpoint_model,
      tokens_prompt,
      tokens_completion,
      status,
      error_message,
      user_id: 'system_etl'
    }]);
  } catch(e) {
    console.error("No se pudo loguear el uso de API en ETL", e);
  }
}

// Función auxiliar para reintentar llamadas a Gemini
async function generateContentWithRetry(prompt, retries = 5, delay = 4000) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      const usage = response.usageMetadata || {};
      await logApiUsageToSupabase('Gemini', 'youtube_etl', 'gemini-2.5-flash', usage.promptTokenCount || 0, usage.candidatesTokenCount || 0, 'success', null);
      
      return response.text();
    } catch (err) {
      const errMsg = err.message || '';
      const isDailyLimit = errMsg.includes('GenerateRequestsPerDay') || errMsg.includes('RequestsPerDay') || errMsg.includes('limit: 20');
      
      if (isDailyLimit) {
        console.error("\n[Gemini API] Límite diario de peticiones alcanzado.");
        await logApiUsageToSupabase('Gemini', 'youtube_etl', 'gemini-2.5-flash', 0, 0, 'rate_limit', 'Daily Limit reached');
        throw err;
      }

      const isTemporary = err.status === 503 || err.status === 429 || 
                          errMsg.includes('503') || errMsg.includes('429') ||
                          errMsg.includes('Service Unavailable') || errMsg.includes('Too Many Requests');
      
      if (isTemporary && i < retries - 1) {
        console.warn(`[Gemini API] Ocupado/Cuota (Intento ${i + 1}/${retries}). Esperando ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
        continue;
      }
      
      await logApiUsageToSupabase('Gemini', 'youtube_etl', 'gemini-2.5-flash', 0, 0, 'error', err.message);
      throw err;
    }
  }
}

// Helper para obtener el último video de un canal usando su RSS feed oficial de YouTube
async function getLatestVideoFromRSS(channelId) {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(feedUrl);
  if (!res.ok) throw new Error(`HTTP error ${res.status} al consultar RSS feed para canal ${channelId}`);
  const xmlText = await res.text();

  const titleMatch = xmlText.match(/<entry>[\s\S]*?<title>(.*?)<\/title>/);
  const videoIdMatch = xmlText.match(/<entry>[\s\S]*?<yt:videoId>(.*?)<\/yt:videoId>/);

  if (!videoIdMatch || !videoIdMatch[1]) {
    return null;
  }

  return {
    videoId: videoIdMatch[1],
    title: titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : 'Sin Título'
  };
}

export async function runETL(onProgress) {
  console.log("Iniciando ETL de YouTube Insights para todos los canales...");

  // 1. Leer TODOS los canales registrados en Supabase
  const { data: channels, error: channelsError } = await supabase
    .from('tracked_channels')
    .select('*');

  if (channelsError) {
    console.error("Error obteniendo canales:", channelsError);
    return { success: false, error: channelsError.message };
  }

  if (!channels || channels.length === 0) {
    console.log("No hay canales para procesar.");
    return { success: true, processed: 0, skipped: 0 };
  }

  console.log(`Canales a procesar (${channels.length}):`, channels.map(c => c.channel_name));

  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i];
    const statusMsg = `Procesando canal (${i + 1}/${channels.length}): ${channel.channel_name}`;
    console.log(`\n${statusMsg}`);
    if (onProgress) onProgress(statusMsg, i + 1, channels.length);

    try {
      // 2. Obtener el último video del canal vía RSS feed
      const latestVideo = await getLatestVideoFromRSS(channel.channel_id);
      if (!latestVideo) {
        console.log(`⚠️ No se encontraron videos en el feed RSS del canal ${channel.channel_name}.`);
        skippedCount++;
        continue;
      }

      const videoId = latestVideo.videoId;
      console.log(`Último video detectado: "${latestVideo.title}" (ID: ${videoId})`);

      // 3. Verificar si el video ya existe en la DB
      const { data: existingVideo } = await supabase
        .from('youtube_video_logs')
        .select('video_id')
        .eq('video_id', videoId)
        .single();

      if (existingVideo) {
        console.log(`⏩ El video ${videoId} ya fue analizado previamente. Haciendo skip.`);
        skippedCount++;
        continue;
      }

      // 4. Obtener transcripción
      console.log("Obteniendo transcripción...");
      let transcriptText = "";
      try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        transcriptText = transcript.map(t => t.text).join(' ');
        await logApiUsageToSupabase('YouTube', 'youtube_etl_transcript', 'youtube-transcript', 0, 0, 'success', null);
      } catch (e) {
        console.error("⚠️ No se pudo obtener la transcripción (video sin subtítulos):", e.message);
        await logApiUsageToSupabase('YouTube', 'youtube_etl_transcript', 'youtube-transcript', 0, 0, 'error', e.message);
        skippedCount++;
        continue;
      }

      if (!transcriptText || transcriptText.trim().length === 0) {
        console.log("La transcripción está vacía.");
        skippedCount++;
        continue;
      }

      // 5. Enviar a Gemini
      console.log("Llamando a Gemini AI para generar resumen e insights...");
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

      let textResponse = "";
      try {
        const rawResponse = await generateContentWithRetry(prompt);
        textResponse = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
      } catch (geminiErr) {
        console.error(`Error de Gemini al procesar el canal ${channel.channel_name}:`, geminiErr.message);
        errorCount++;
        continue;
      }

      let sector = "Finanzas";
      let summary = "No se pudo extraer el resumen.";
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
        console.error("Error parseando el JSON de Gemini:", err);
        summary = textResponse;
      }

      // 6. Guardar en Supabase
      console.log("Guardando resumen en Supabase (youtube_video_logs)...");
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
          published_at: new Date().toISOString()
        }]);

      if (insertError) {
        console.error("Error insertando en la base de datos:", insertError.message);
        errorCount++;
      } else {
        console.log(`✅ ¡Éxito! Procesado "${latestVideo.title}" de ${channel.channel_name}`);
        processedCount++;
      }

      // Delay de cortesía de 3s
      if (i < channels.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (err) {
      console.error(`Error procesando el canal ${channel.channel_name}:`, err.message);
      errorCount++;
    }
  }

  console.log(`\n================================================-------`);
  console.log(`[ETL FINALIZADO] Procesados: ${processedCount} | Skipped: ${skippedCount} | Errores: ${errorCount}`);
  console.log(`=======================================================\n`);

  return { success: true, processed: processedCount, skipped: skippedCount, errors: errorCount };
}

// Si se ejecuta directamente desde Node CLI
if (process.argv[1] && process.argv[1].includes('etl_youtube_insights.js')) {
  runETL();
}
