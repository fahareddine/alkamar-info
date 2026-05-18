'use strict';
// ── POST /api/contact — Formulaire de contact ─────────────────────────────────
// Reçoit : { nom, email, message, _honey?, subject?, phone? }
// Actions :
//   1. Valide et sanitize
//   2. Enregistre dans Supabase (table contacts)
//   3. Envoie confirmation email au client
//   4. Envoie notification admin
//   5. Retourne JSON { ok: true }

const { supabase } = require('./_lib/supabase');
const { setCors }  = require('./_lib/cors');
const {
  sendContactConfirmation,
  sendContactAdminNotification,
  isValidEmail,
} = require('./_lib/email');

module.exports = async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Méthode non autorisée' });

  const body = req.body || {};

  // ── Honeypot anti-spam ─────────────────────────────────────────────────────
  if (body._honey || body.website || body.url) {
    return res.status(200).json({ ok: true }); // silencieux pour ne pas indiquer aux bots
  }

  // ── Extraction & validation ────────────────────────────────────────────────
  const name    = String(body.nom   || body.name    || '').trim().slice(0, 200);
  const email   = String(body.email || '').trim().slice(0, 254).toLowerCase();
  const message = String(body.message || '').trim().slice(0, 4000);
  const phone   = String(body.phone || body.telephone || '').trim().slice(0, 50);
  const subject = String(body.subject || body.sujet  || '').trim().slice(0, 200);
  const source  = String(body.source || 'hero-contact-form').trim().slice(0, 100);

  const errors = [];
  if (!name || name.length < 2)     errors.push('Nom obligatoire (minimum 2 caractères).');
  if (!isValidEmail(email))         errors.push('Adresse email invalide.');
  if (!message || message.length < 10) errors.push('Message trop court (minimum 10 caractères).');
  if (message.length > 4000)        errors.push('Message trop long (maximum 4000 caractères).');

  if (errors.length) return res.status(400).json({ errors });

  // ── Insertion Supabase ─────────────────────────────────────────────────────
  let contactId = null;
  try {
    const { data: contact } = await supabase.from('contacts').insert({
      name,
      email,
      phone:   phone   || null,
      subject: subject || null,
      message,
      source,
      status: 'new',
    }).select('id').single();
    contactId = contact?.id || null;
  } catch (e) {
    // Table peut ne pas encore exister — non bloquant
    console.warn('[contact] Insert Supabase failed (table manquante ?):', e.message);
  }

  // ── Emails en arrière-plan (ne bloque pas la réponse) ─────────────────────
  Promise.all([
    sendContactConfirmation({ name, email, message, subject: subject || null, phone: phone || null })
      .catch(e => console.error('[contact] Confirmation email failed:', e.message)),
    sendContactAdminNotification({ name, email, message, subject: subject || null, phone: phone || null, source, contactId })
      .catch(e => console.error('[contact] Admin email failed:', e.message)),
  ]);

  return res.status(200).json({ ok: true, message: 'Nous vous répondrons dans les meilleurs délais.' });
};
