-- Crear tabla para almacenar el log de uso de APIs
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL, -- e.g., 'Gemini', 'JBlanked', 'Yahoo Finance', 'YouTube'
    feature VARCHAR(100) NOT NULL, -- e.g., 'vision_extract', 'ai_movement_analysis', 'youtube_etl'
    endpoint_model VARCHAR(100), -- e.g., 'gemini-1.5-flash', '/calendar/today/'
    tokens_prompt INTEGER DEFAULT 0,
    tokens_completion INTEGER DEFAULT 0,
    cost_estimate DECIMAL(10, 6) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'success', -- 'success', 'error', 'rate_limit'
    error_message TEXT,
    user_id VARCHAR(100), -- ID temporal del usuario o 'system'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar Row Level Security
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Borrar politicas previas si existen
DROP POLICY IF EXISTS "Allow public insert access on api_usage_logs" ON public.api_usage_logs;
DROP POLICY IF EXISTS "Allow public read access on api_usage_logs" ON public.api_usage_logs;

-- Políticas de RLS con ROLES EXPLÍCITOS
-- Permitir inserciones a cualquier usuario (anonimo o autenticado)
CREATE POLICY "Allow public insert access on api_usage_logs" 
ON public.api_usage_logs 
AS PERMISSIVE FOR INSERT 
TO public
WITH CHECK (true);

-- Permitir lectura pública (para el dashboard)
CREATE POLICY "Allow public read access on api_usage_logs" 
ON public.api_usage_logs 
AS PERMISSIVE FOR SELECT 
TO public
USING (true);
