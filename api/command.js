import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { agentId, type, ...commandData } = req.body;
    
    if (!agentId || !type) {
      return res.status(400).json({ error: 'Missing agentId or type' });
    }

    // Save command to database
    const command = {
      agent_id: agentId,
      type: type,
      data: commandData,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('commands')
      .insert(command)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ 
      status: 'ok', 
      commandId: data.id,
      message: 'Command queued'
    });
  }

  // GET: Fetch pending commands for agent
  if (req.method === 'GET') {
    const { agentId } = req.query;
    
    if (!agentId) {
      return res.status(400).json({ error: 'Missing agentId' });
    }

    const { data: commands, error } = await supabase
      .from('commands')
      .select('*')
      .eq('agent_id', agentId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Flatten data field into command object
    const flattenedCommands = (commands || []).map(cmd => ({
      id: cmd.id,
      type: cmd.type,
      status: cmd.status,
      ...cmd.data
    }));

    return res.status(200).json(flattenedCommands);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
