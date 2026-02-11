import { createClient } from '@supabase/supabase-js';

// Инициализация Supabase через переменные окружения
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Добавляем CORS, чтобы можно было обращаться из браузера и билда
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Логика POST: Билд присылает данные о себе
  if (req.method === 'POST') {
    const { id, hostname } = req.body;
    if (!id) return res.status(400).json({ error: 'No ID provided' });

    const { error } = await supabase
      .from('agents')
      .upsert({ 
        id, 
        hostname: hostname || 'Unknown', 
        last_seen: new Date().toISOString() 
      });

    if (error) return res.status(500).json(error);
    return res.status(200).json({ status: 'ok' });
  }

  // Логика GET: Сайт запрашивает список всех воркеров
  const { data: agents, error } = await supabase
    .from('agents')
    .select('*')
    .order('last_seen', { ascending: false });

  if (error) return res.status(500).json(error);
  return res.status(200).json(agents);
}