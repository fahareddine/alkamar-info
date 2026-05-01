const { createClient } = require('@supabase/supabase-js');
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

// ── Profil client (JWT Supabase, ?profile=1) ─────────────────────────────────
async function handleProfile(req, res) {
  const sbAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  const { data: userData } = await sbAuth.auth.getUser(token);
  if (!userData?.user) return res.status(401).json({ error: 'Non authentifié' });
  const userId = userData.user.id;

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('customer_profiles').select('*').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    return res.status(200).json(data || null);
  }
  if (req.method === 'POST') {
    const { first_name, last_name, phone, country, city, address, postal_code, terms, privacy } = req.body || {};
    if (!first_name || !last_name || !phone || !city || !address) return res.status(400).json({ error: 'Champs obligatoires manquants' });
    if (!terms) return res.status(400).json({ error: 'CGV non acceptées' });
    const now = new Date().toISOString();
    const payload = { user_id: userId, first_name: first_name.trim(), last_name: last_name.trim(), phone: phone.trim(), country: (country || 'KM').trim(), city: city.trim(), address: address.trim(), postal_code: (postal_code || '').trim(), terms_accepted_at: now, privacy_accepted_at: privacy ? now : null, updated_at: now };
    const { data: ex } = await supabase.from('customer_profiles').select('id').eq('user_id', userId).single();
    const op = ex ? supabase.from('customer_profiles').update(payload).eq('user_id', userId).select().single() : supabase.from('customer_profiles').insert(payload).select().single();
    const { data, error } = await op;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Route profil client — JWT Supabase, pas d'auth admin requise
  if (req.query.profile === '1') return handleProfile(req, res);

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
