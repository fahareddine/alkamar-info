const { createClient } = require('@supabase/supabase-js');
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');
const { sendContactConfirmation, sendContactAdminNotification, isValidEmail } = require('./_lib/email');

// ── Formulaire de contact — public ───────────────────────────────────────────
async function handleContact(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  const body = req.body || {};
  if (body._honey || body.website || body.url) return res.status(200).json({ ok: true });
  const name       = String(body.nom   || body.name    || '').trim().slice(0, 200);
  const email      = String(body.email || '').trim().slice(0, 254).toLowerCase();
  const rawMessage = String(body.message || '').trim();
  const message    = rawMessage.slice(0, 4000);
  const phone      = String(body.phone || body.telephone || '').trim().slice(0, 50);
  const subject    = String(body.subject || body.sujet  || '').trim().slice(0, 200);
  const source     = String(body.source || 'hero-contact-form').trim().slice(0, 100);
  const errors = [];
  if (!name || name.length < 2)          errors.push('Nom obligatoire (minimum 2 caractères).');
  if (!isValidEmail(email))              errors.push('Adresse email invalide.');
  if (!rawMessage || rawMessage.length < 10) errors.push('Message trop court (minimum 10 caractères).');
  if (rawMessage.length > 4000)          errors.push('Message trop long (maximum 4000 caractères).');
  if (errors.length) return res.status(400).json({ errors });
  let contactId = null;
  try {
    const { data: contact } = await supabase.from('contacts').insert({ name, email, phone: phone || null, subject: subject || null, message, source, status: 'new' }).select('id').single();
    contactId = contact?.id || null;
  } catch (e) { console.warn('[contact] Insert failed:', e.message); }
  // await obligatoire sur Vercel — fonction coupée après res.json() si fire-and-forget
  await Promise.all([
    sendContactConfirmation({ name, email, message, subject: subject || null, phone: phone || null }).catch(e => console.error('[contact] confirm email failed:', e.message)),
    sendContactAdminNotification({ name, email, message, subject: subject || null, phone: phone || null, source, contactId }).catch(e => console.error('[contact] admin email failed:', e.message)),
  ]);
  return res.status(200).json({ ok: true, message: 'Nous vous répondrons dans les meilleurs délais.' });
}

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
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Route profil client — JWT Supabase, pas d'auth admin requise
  if (req.query.profile === '1') return handleProfile(req, res);

  // Route formulaire de contact — publique
  if (req.query._route === 'contact') return handleContact(req, res);

  // Route diagnostic email — temporaire (à supprimer après debug)
  if (req.query._route === 'email-test' && req.query._key === 'diag2026tmp') {
    const https = require('https');
    const apiKey = process.env.RESEND_API_KEY || '';
    const from   = process.env.EMAIL_FROM || 'MISSING';
    if (!apiKey || apiKey.startsWith('re_VOTRE')) {
      return res.status(200).json({ configured: false, from, error: 'RESEND_API_KEY absent ou placeholder' });
    }
    const body = JSON.stringify({ from, to: ['defistylez@gmail.com'], subject: '[DIAG] Test email Vercel', html: '<p>Test diagnostic depuis Vercel</p>', text: 'Test diagnostic depuis Vercel' });
    const result = await new Promise((resolve) => {
      const req2 = https.request({ hostname: 'api.resend.com', path: '/emails', method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (r) => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => resolve({ status: r.statusCode, data: d }));
      });
      req2.on('error', (e) => resolve({ error: e.message }));
      req2.write(body); req2.end();
    });
    return res.status(200).json({ configured: true, from: from.slice(0, 30) + '...', resend_status: result.status, resend_response: result.data?.slice(0, 500), key_prefix: apiKey.slice(0, 12) + '...' });
  }

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
