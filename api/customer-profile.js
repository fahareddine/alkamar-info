// api/customer-profile.js — GET/POST profil client (JWT Supabase)
const { createClient } = require('@supabase/supabase-js');
const { setCors } = require('./_lib/cors');

const sbServer = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function verifyJwt(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  const { data, error } = await sbServer.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyJwt(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  if (req.method === 'GET') {
    const { data, error } = await sbServer
      .from('customer_profiles').select('*').eq('user_id', user.id).single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    return res.status(200).json(data || null);
  }

  if (req.method === 'POST') {
    const { first_name, last_name, phone, country, city, address, postal_code, terms, privacy } = req.body || {};
    if (!first_name || !last_name || !phone || !city || !address)
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    if (!terms) return res.status(400).json({ error: 'CGV non acceptées' });
    const now = new Date().toISOString();
    const payload = {
      user_id: user.id, first_name: first_name.trim(), last_name: last_name.trim(),
      phone: phone.trim(), country: (country||'KM').trim(), city: city.trim(),
      address: address.trim(), postal_code: (postal_code||'').trim(),
      terms_accepted_at: now, privacy_accepted_at: privacy ? now : null, updated_at: now,
    };
    const { data: existing } = await sbServer.from('customer_profiles').select('id').eq('user_id', user.id).single();
    const op = existing
      ? sbServer.from('customer_profiles').update(payload).eq('user_id', user.id).select().single()
      : sbServer.from('customer_profiles').insert(payload).select().single();
    const { data, error } = await op;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
