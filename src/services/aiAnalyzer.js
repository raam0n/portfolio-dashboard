import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { logApiUsage } from './apiLogger.js';

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
      logApiUsage({ service_name: 'Yahoo Finance', feature: 'ai_movement_analysis', endpoint_model: '/v1/finance/search' });
    }
  } catch (err) {
    console.warn("Error fetching news from Yahoo Finance:", err);
    logApiUsage({ service_name: 'Yahoo Finance', feature: 'ai_movement_analysis', endpoint_model: '/v1/finance/search', status: 'error', error_message: err.message });
  }

  // 1.5 Fetch macro events from JBlanked API
  let macroContext = "Sin eventos macro importantes hoy.";
  const JKEY = import.meta.env.VITE_JBLANKED_API_KEY;
  if (JKEY) {
    try {
      const jRes = await fetch(`https://www.jblanked.com/news/api/forex-factory/calendar/today/`, {
        headers: { 'Authorization': `Api-Key ${JKEY}` }
      });
      if (jRes.ok) {
        const jData = await jRes.json();
        // Assuming jData is an array of events
        if (Array.isArray(jData) && jData.length > 0) {
          macroContext = jData.map(e => `- ${e.title || e.name} (${e.currency || e.country}): Actual ${e.actual || 'N/A'}, Previo ${e.previous || 'N/A'}`).join('\n');
        }
        logApiUsage({ service_name: 'JBlanked', feature: 'ai_movement_analysis', endpoint_model: '/calendar/today/' });
      }
    } catch (e) {
      console.warn("Error fetching JBlanked events:", e);
      logApiUsage({ service_name: 'JBlanked', feature: 'ai_movement_analysis', endpoint_model: '/calendar/today/', status: 'error', error_message: e.message });
    }
  }

  const combinedContext = `[MICRO] ${newsContext}\n[MACRO] ${macroContext}`;

  // 2. Query cache from Supabase (valid for 1 week and matching combined news/macro)
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
      if (lastCached.news_context === combinedContext) {
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
          catalizador_principal: { 
            type: SchemaType.STRING, 
            enum: ["Corporativo", "Macroeconómico", "Técnico/Ruido", "Cripto/Liquidez", "Local/Regulatorio"] 
          },
          factores_clave: { 
            type: SchemaType.ARRAY, 
            items: { type: SchemaType.STRING } 
          },
          nivel_certeza: { 
            type: SchemaType.STRING, 
            enum: ["Alta", "Media", "Baja"] 
          }
        },
        required: ["ticker", "variacion_analizada", "resumen_ejecutivo", "catalizador_principal", "factores_clave", "nivel_certeza"]
      }
    }
  });

  const prompt = `[ROL Y OBJETIVO]
Eres un Analista Financiero Cuantitativo y Macro-Estratega Senior. Tu objetivo es explicar de forma concisa los movimientos de precio de distintos activos financieros, integrando el flujo de noticias corporativas (micro) con el contexto de eventos económicos (macro), evaluando críticamente las señales de sentimiento algorítmico provistas.

[VARIABLES DE ENTRADA]
- Ticker del Activo: ${ticker}
- Variación de Precio: ${priceChange}%
- Noticias Corporativas/Contexto (Yahoo Finance): 
${newsContext}
- Eventos Macro del Día y Sentimiento (JBlanked API): 
${macroContext}

[REGLAS DE RAZONAMIENTO Y PONDERACIÓN]
1. Jerarquía de Catalizadores: Analiza primero si existe un evento corporativo directo en Yahoo Finance (ej. presentación de balances). Si las noticias corporativas son nulas o débiles, busca la explicación en el impacto de los eventos macroeconómicos de JBlanked.
2. Evaluación Crítica del "Smart Analysis": Recibirás un sentimiento pre-calculado (Bullish/Bearish) y métricas (Outcome, Strength, Quality) de JBlanked. Sé crítico con este sentimiento algorítmico. Un dato macroeconómico "Fuerte y Positivo" para EE.UU. (ej. inflación por encima de lo esperado) suele ser alcista para el dólar, pero bajista para la renta variable por el encarecimiento del crédito.
3. Diferenciación Estricta de Mercados:
   - Acciones Internacionales (EE.UU.): Para activos como BRK.B o índices del S&P/Nasdaq, evalúa cómo el dato macro afecta la política monetaria de la FED, el costo de capital y la rotación sectorial.
   - Acciones y ADRs Argentinos: Para activos como GGAL o YPF, el peso del riesgo país, la política regulatoria local o el tipo de cambio financiero (MEP/CCL) suele opacar a la macro estadounidense. Pondera esto si los feeds lo mencionan.
   - Renta Fija / Bonos: Para instrumentos como BOPREAL o soberanos, prioriza la acumulación de reservas, superávit fiscal o noticias de reestructuración.
   - Criptoactivos: Para Bitcoin y ecosistema cripto, enfócate estrictamente en eventos de liquidez sistémica, flujos de ETFs o regulaciones institucionales.
4. Escepticismo y Ruido: Si el movimiento del precio no se alinea ni con las noticias micro ni con la macro, declara de forma contundente que el movimiento responde a factores técnicos, flujo de fondos o ruido de mercado. No inventes correlaciones.`;

  try {
    const result = await model.generateContent(prompt);
    
    // Loguear uso de Gemini
    const usage = result.response.usageMetadata || {};
    logApiUsage({ 
        service_name: 'Gemini', 
        feature: 'ai_movement_analysis', 
        endpoint_model: 'gemini-3.5-flash',
        tokens_prompt: usage.promptTokenCount || 0,
        tokens_completion: usage.candidatesTokenCount || 0
    });

    const text = result.response.text();
    const parsedResult = JSON.parse(text);

    // Save to cache in Supabase asynchronously
    supabase
      .from('ai_movement_analysis')
      .insert([{
        ticker: ticker,
        news_context: combinedContext,
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
    logApiUsage({ 
        service_name: 'Gemini', 
        feature: 'ai_movement_analysis', 
        endpoint_model: 'gemini-3.5-flash',
        status: 'error',
        error_message: detail
    });
    throw new Error(`Error de IA: ${detail}`);
  }
}
