import 'dotenv/config';
import ytSearch from 'yt-search';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from '@google/generative-ai';

const geminiApiKey = process.env.VITE_GEMINI_API_KEY;
if (!geminiApiKey) {
  console.error("Falta la variable de entorno GEMINI_API_KEY.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function generateContentWithRetry(prompt, retries = 5, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err) {
      if (i < retries - 1) {
        console.warn(`[Gemini API] Ocupado. Reintentando en ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
        continue;
      }
      throw err;
    }
  }
}

async function testTranscriptAndGemini() {
  console.log("1. Buscando canal 'Arte de Invertir'...");
  const searchResult = await ytSearch('Arte de Invertir');
  const latestVideo = searchResult.videos[0];
  const videoId = latestVideo.videoId;
  
  console.log(`Video encontrado: ${latestVideo.title} (ID: ${videoId})`);

  console.log("\n2. Extrayendo transcripción...");
  let transcriptText = "";
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    transcriptText = transcript.map(t => t.text).join(' ');
    console.log(`\n=== MUESTRA DE TRANSCRIPCIÓN (Primeros 500 caracteres) ===\n${transcriptText.substring(0, 500)}...\n=======================================================\n`);
  } catch (e) {
    console.error("Error obteniendo la transcripción:", e.message);
    return;
  }

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

  console.log("3. Llamando a Gemini con el prompt de ETL...");
  try {
    const textResponse = await generateContentWithRetry(prompt);
    console.log("\n=== RESPUESTA CRUDA DE GEMINI ===");
    console.log(textResponse);
    console.log("=================================\n");

    console.log("4. Probando parseo JSON de Gemini...");
    const cleanJson = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    console.log(JSON.stringify(parsed, null, 2));
    
  } catch (e) {
    console.error("Error en Gemini o Parseo JSON:", e);
  }
}

testTranscriptAndGemini();
