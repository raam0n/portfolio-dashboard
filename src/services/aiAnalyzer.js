import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function analyzeMovement(ticker, priceChange) {
  if (!genAI) {
    throw new Error('La API Key de Gemini no está configurada (VITE_GEMINI_API_KEY).');
  }

  // 1. Fetch recent news from Yahoo Finance Search API
  let newsContext = "No se encontraron noticias recientes.";
  try {
    const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=6`);
    if (res.ok) {
      const data = await res.json();
      if (data.news && data.news.length > 0) {
        newsContext = data.news.map(n => `- ${n.title} (${n.publisher})`).join('\n');
      }
    }
  } catch (err) {
    console.warn("Error fetching news from Yahoo Finance:", err);
  }

  // 2. Query cache from Supabase (valid for 1 week and matching news)
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const { data: cached, error: cacheError } = await supabase
      .from('ai_movement_analysis')
      .select('analysis_json, news_context')
      .eq('ticker', ticker)
      .gte('created_at', oneWeekAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (!cacheError && cached && cached.length > 0) {
      const lastCached = cached[0];
      if (lastCached.news_context === newsContext) {
        console.log(`[Cache Hit] Reutilizando análisis previo para: ${ticker}`);
        return lastCached.analysis_json;
      }
    }
  } catch (cacheErr) {
    console.warn("Error al leer de la caché de Supabase:", cacheErr);
  }

  // 3. Build the model request
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          ticker: { type: SchemaType.STRING },
          variacion_analizada: { type: SchemaType.STRING },
          resumen_ejecutivo: { type: SchemaType.STRING },
          factores_clave: { 
            type: SchemaType.ARRAY, 
            items: { type: SchemaType.STRING } 
          },
          nivel_certeza: { 
            type: SchemaType.STRING, 
            enum: ["Alta", "Media", "Baja"] 
          },
          tipo_driver: { 
            type: SchemaType.STRING, 
            enum: ["Fundamental Directo", "Sectorial", "Macro/Geopolítico", "Técnico/Ruido"] 
          }
        },
        required: ["ticker", "variacion_analizada", "resumen_ejecutivo", "factores_clave", "nivel_certeza", "tipo_driver"]
      }
    }
  });

  const prompt = `[ROL Y OBJETIVO]
Eres un Analista Financiero Cuantitativo y Macro-Estratega Senior. Tu objetivo es explicar de forma concisa y profesional los movimientos bruscos de precio de distintos activos financieros, basándote en la correlación entre la variación del precio, el flujo de noticias recientes, el contexto macroeconómico y las dinámicas sectoriales.

[ENTRADAS QUE RECIBIRÁS]
- Ticker del Activo: ${ticker}
- Variación de Precio: ${priceChange}%
- Fecha Actual: ${new Date().toLocaleDateString('es-AR')}
- Noticias y Contexto Scrapeado: 
${newsContext}

[REGLAS DE RAZONAMIENTO]
1. Prioridad de Causalidad: Busca primero eventos corporativos directos (balances trimestrales, M&A, cambios de management). Si no los hay, escala a dinámicas sectoriales (movimientos de la competencia directa, nuevas regulaciones) y finalmente a factores macro (tasas de interés, geopolítica, índices bursátiles).
2. Diferenciación de Mercados: Para activos argentinos (ADRs, acciones locales, bonos), el peso de la política local, los cambios regulatorios o las variaciones en los tipos de cambio financieros suele ser el driver principal. Para activos de EE.UU. (S&P 500, Nasdaq), enfócate en la política monetaria global y el rendimiento sectorial.
3. Escepticismo: Si las noticias provistas no tienen una relación causal lógica con la variación de precio, decláralo explícitamente. Es preferible indicar que el movimiento responde a dinámicas técnicas o a simple ruido de mercado antes que inventar una correlación inexistente.
4. Precisión de Entidades: Respeta estrictamente los tickers enviados. Si recibes BRK.B, analiza el holding Berkshire Hathaway Clase B.
5. Idioma: Toda la respuesta y redacción debe ser en Español.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsedResult = JSON.parse(text);

    // Save to cache in Supabase asynchronously
    supabase
      .from('ai_movement_analysis')
      .insert([{
        ticker: ticker,
        news_context: newsContext,
        analysis_json: parsedResult
      }])
      .then(({ error }) => {
        if (error) console.warn("Error guardando el análisis en caché de Supabase:", error.message);
        else console.log(`[Cache Write] Análisis guardado exitosamente para: ${ticker}`);
      });

    return parsedResult;
  } catch (error) {
    console.error("Gemini API Error:", error);
    const detail = error?.message || error?.statusText || String(error);
    throw new Error(`Error de IA: ${detail}`);
  }
}
