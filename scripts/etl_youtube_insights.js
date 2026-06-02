import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ytSearch from 'yt-search';
import { execSync } from 'child_process';
import fs from 'fs';
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

      // 4. Obtener transcripción usando yt-dlp (evita bloqueos de IP de GitHub Actions)
      console.log("Obteniendo transcripción con yt-dlp...");
      let transcriptText = "";
      try {
        // Limpiamos subtítulos previos por las dudas
        const oldFiles = fs.readdirSync('.').filter(f => f.startsWith('sub_') && f.endsWith('.vtt'));
        for (const f of oldFiles) fs.unlinkSync(f);

        // yt-dlp intentará descargar subtítulos manuales o automáticos en español o inglés
        execSync(`yt-dlp --write-auto-sub --write-sub --sub-lang "es.*,en.*" --skip-download --sub-format vtt -o "sub_${videoId}" "https://www.youtube.com/watch?v=${videoId}"`, { stdio: 'pipe' });
        
        // yt-dlp crea archivos como sub_VIDEOID.es.vtt
        const files = fs.readdirSync('.');
        const subFile = files.find(f => f.startsWith(`sub_${videoId}`) && f.endsWith('.vtt'));
        
        if (subFile) {
           transcriptText = fs.readFileSync(subFile, 'utf8');
           fs.unlinkSync(subFile); // Limpieza
        } else {
           throw new Error("No se encontró el archivo de subtítulos generado por yt-dlp.");
        }
      } catch (e) {
        console.error("Error obteniendo la transcripción con yt-dlp:", e.message);
        continue;
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
          published_at: latestVideo.timestamp || new Date().toISOString()
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
