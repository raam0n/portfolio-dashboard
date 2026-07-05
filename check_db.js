import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Chequeando canales...");
  const { data: channels } = await supabase.from('tracked_channels').select('*');
  console.log(channels);

  console.log("Chequeando logs...");
  const { data: logs } = await supabase.from('youtube_video_logs').select('video_title, channel_name');
  console.log(logs);
}

check();
