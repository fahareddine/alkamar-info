const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireRole(req, 'admin', 'commercial');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  if (req.method === 'GET') {
    const { search, limit = '50', offset = '0' } = req.query;
    let query = supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
