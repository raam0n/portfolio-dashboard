import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS configuration (optional, if you access from a different domain)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase credentials are not configured in Vercel." });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch logs ordered by date
    const { data, error } = await supabase
      .from('youtube_video_logs')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(50); // Get latest 50

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
