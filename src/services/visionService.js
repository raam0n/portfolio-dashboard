import { GoogleGenerativeAI } from '@google/generative-ai';
import { logApiUsage } from './apiLogger.js';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

/**
 * Extracts portfolio data (ticker, average price, quantity) from a screenshot.
 * @param {string} base64Data - The base64 string of the image (without the data:image/...;base64, prefix)
 * @param {string} mimeType - The mime type of the image (e.g., 'image/png')
 * @returns {Promise<{ticker?: string, precio_promedio?: number, cantidad?: number}>}
 */
export async function extractPortfolioDataFromImage(base64Data, mimeType) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Eres un asistente financiero experto. Analiza esta captura de pantalla de un broker.
Identifica TODOS los activos (acciones, cedears, bonos) listados en la imagen.
Para cada uno, extrae:
- "ticker": string (Símbolo)
- "cantidad": number (Cantidad de nominales)
- "precio_promedio": number (Precio Promedio de Compra, PPC, o Precio de Compra)
- "tipo": string (deduce si es "accion", "cedear" o "bono" basado en el ticker o contexto. Ej: SPY es cedear, AL30/GD41 son bono, GGAL es accion).

Limpia los números de precio y cantidad (elimina el símbolo $, usa PUNTO para decimales, elimina separadores de miles).
Devuelve ESTRICTAMENTE un ARRAY de objetos JSON. Ningún otro texto, solo el JSON array puro. Empieza con [ y termina con ].
Ejemplo:
[
  { "ticker": "GGAL", "cantidad": 1400, "precio_promedio": 6560.78, "tipo": "accion" },
  { "ticker": "GD41", "cantidad": 59, "precio_promedio": 954.70, "tipo": "bono" }
]
`;

    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType
        }
      }
    ];

    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro",
      "gemini-1.5-pro-latest",
      "gemini-1.0-pro-vision-latest"
    ];

    let result;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent([prompt, ...imageParts]);
        console.log(`[EXITO] Se utilizó el modelo: ${modelName}`);
        
        // Loguear uso de Gemini
        const usage = result.response.usageMetadata || {};
        logApiUsage({ 
            service_name: 'Gemini', 
            feature: 'vision_extract', 
            endpoint_model: modelName,
            tokens_prompt: usage.promptTokenCount || 0,
            tokens_completion: usage.candidatesTokenCount || 0
        });

        break; 
      } catch (e) {
        if (e.message && e.message.includes('404')) {
          console.warn(`[INFO] Modelo ${modelName} no disponible (404), intentando el siguiente...`);
          lastError = e;
        } else {
          // Otros errores (credenciales inválidas, rate limit) los frenamos aquí.
          throw e;
        }
      }
    }

    if (!result) {
      throw new Error(`Ningún modelo de visión soportado por tu API Key. Último error: ${lastError?.message}`);
    }
    
    const responseText = result.response.text();
    console.log("=== RAW GEMINI OUTPUT ===");
    console.log(responseText);
    console.log("=========================");
    
    // Limpiar posible formato markdown (ej. ```json ... ```)
    let cleanedText = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    
    // Algunas veces la IA puede responder texto antes del JSON, buscamos el primer [ o {
    const firstBracket = cleanedText.indexOf('[');
    const firstBrace = cleanedText.indexOf('{');
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      cleanedText = cleanedText.substring(firstBracket);
    } else if (firstBrace !== -1) {
      cleanedText = cleanedText.substring(firstBrace);
    }
    
    // Y limpiar texto final
    const lastBracket = cleanedText.lastIndexOf(']');
    const lastBrace = cleanedText.lastIndexOf('}');
    if (lastBracket !== -1 && (lastBrace === -1 || lastBracket > lastBrace)) {
      cleanedText = cleanedText.substring(0, lastBracket + 1);
    } else if (lastBrace !== -1) {
      cleanedText = cleanedText.substring(0, lastBrace + 1);
    }

    const parsedData = JSON.parse(cleanedText);
    return parsedData;

  } catch (error) {
    console.error("Error al extraer datos con Gemini Vision:", error);
    logApiUsage({ 
        service_name: 'Gemini', 
        feature: 'vision_extract', 
        endpoint_model: 'vision-multi',
        status: 'error',
        error_message: error.message
    });
    throw new Error("No se pudo analizar la imagen. Revisa la consola (F12) para ver el log. Error interno: " + error.message);
  }
}
