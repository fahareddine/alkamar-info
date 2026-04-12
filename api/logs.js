// api/logs.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { entity_type, entity_id, action, limit = '100', offset = '0' } = req.query;

  let query = supabase
    .from('admin_logs')
    .select(`
      id, action, entity_type, entity_id,
      old_value, new_value, ip_address, created_at,
      user_profiles(id, full_name)
    `)
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (entity_type) query = query.eq('entity_type', entity_type);
  if (entity_id) query = query.eq('entity_id', entity_id);
  if (action) query = query.eq('action', action);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
};
