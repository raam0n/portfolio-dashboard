import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Simple user id tracking for anonymous users
let getUserId = () => {
    let id = localStorage.getItem('anon_user_id');
    if (!id) {
        id = 'user_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('anon_user_id', id);
    }
    return id;
};

/**
 * Logs API usage to Supabase.
 * @param {Object} params
 * @param {string} params.service_name - 'Gemini', 'JBlanked', 'Yahoo Finance', 'Supabase'
 * @param {string} params.feature - 'vision_extract', 'ai_movement_analysis', etc.
 * @param {string} params.endpoint_model - 'gemini-3.5-flash', '/calendar/today/', etc.
 * @param {number} params.tokens_prompt - Prompt tokens used
 * @param {number} params.tokens_completion - Completion tokens used
 * @param {string} params.status - 'success' or 'error'
 * @param {string} params.error_message - Error details if any
 */
export async function logApiUsage({
    service_name,
    feature,
    endpoint_model = '',
    tokens_prompt = 0,
    tokens_completion = 0,
    status = 'success',
    error_message = null
}) {
    try {
        const userId = getUserId();
        await supabase.from('api_usage_logs').insert([{
            service_name,
            feature,
            endpoint_model,
            tokens_prompt,
            tokens_completion,
            status,
            error_message,
            user_id: userId
        }]);
    } catch (err) {
        console.error("Error al registrar uso de API:", err);
    }
}
