// TEMPORAIRE — endpoint test Playwright, à supprimer après validation
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const secret = req.query.secret || req.body?.secret;
  if (secret !== 'pw-test-alkamar-9x7z') return res.status(403).json({ error: 'forbidden' });

  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const email = 'playwright@test-alkamar.internal';
  const password = 'TestAlkamar2026!';

  // Supprimer si existant
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users?.find(u => u.email === email);
  if (existing) await sb.auth.admin.deleteUser(existing.id);

  // Créer utilisateur confirmé
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'Test', last_name: 'Playwright' },
  });
  if (error) return res.status(500).json({ error: error.message });

  // Créer profil livraison
  await sb.from('customer_profiles').upsert({
    user_id: data.user.id,
    first_name: 'Test',
    last_name: 'Playwright',
    phone: '+269 33 00 001',
    country: 'KM',
    city: 'Moroni',
    address: '1 rue des tests',
    postal_code: '',
    terms_accepted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return res.status(200).json({ email, password });
};
