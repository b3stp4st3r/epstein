import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { commandId, output, error: cmdError } = req.body;
    
    if (!commandId) {
      return res.status(400).json({ error: 'Missing commandId' });
    }

    // Update command with result
    const { error } = await supabase
      .from('commands')
      .update({
        status: cmdError ? 'failed' : 'completed',
        output: output,
        error: cmdError,
        completed_at: new Date().toISOString()
      })
      .eq('id', commandId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ status: 'ok' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
