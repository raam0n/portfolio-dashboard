CREATE TABLE public.tracked_channels (
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(255) NOT NULL,
    channel_id VARCHAR(255) UNIQUE NOT NULL, -- ID de YouTube
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.youtube_video_logs (
    video_id VARCHAR(255) PRIMARY KEY,
    channel_id VARCHAR(255) REFERENCES public.tracked_channels(channel_id),
    channel_name VARCHAR(255) NOT NULL,
    video_title TEXT NOT NULL,
    tickers_mentioned VARCHAR(255),
    sector VARCHAR(255),
    thesis_summary TEXT NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS (opcional para lectura pública, pero se recomienda por seguridad)
ALTER TABLE public.tracked_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_video_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura (permitimos lectura anónima para que la API las lea)
CREATE POLICY "Allow public read access on tracked_channels" ON public.tracked_channels FOR SELECT USING (true);
CREATE POLICY "Allow public read access on youtube_video_logs" ON public.youtube_video_logs FOR SELECT USING (true);
