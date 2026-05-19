'use strict';
// Stub minimal — debug build Vercel
const https = require('https');

const EMAIL_FROM     = process.env.EMAIL_FROM     || 'Info Experts <noreply@info-experts.fr>';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || 'contact@info-experts.fr';
const EMAIL_ADMIN_TO = process.env.EMAIL_ADMIN_TO || 'contact@info-experts.fr';
const TEST_MODE      = process.env.EMAIL_TEST_MODE === 'true';
const TEST_RECIPIENT = process.env.EMAIL_TEST_RECIPIENT || '';

function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e||'')); }

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey || apiKey.startsWith('re_VOTRE')) {
    console.log('[email] skipped:', subject);
    return { skipped: true };
  }
  const recipient = (TEST_MODE && TEST_RECIPIENT) ? TEST_RECIPIENT : to;
  const body = JSON.stringify({ from: EMAIL_FROM, reply_to: EMAIL_REPLY_TO, to: [recipient], subject: TEST_MODE ? `[TEST] ${subject}` : subject, html, text });
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'api.resend.com', path: '/emails', method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { const r = JSON.parse(d); if (res.statusCode >= 400) { resolve({ success: false, error: r.message }); } else { resolve({ success: true, id: r.id }); } } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

async function logEmail() { return; }

async function sendContactConfirmation({ name, email, message }) {
  if (!isValidEmail(email)) return { skipped: true };
  return sendEmail({ to: email, subject: 'Votre message a bien été reçu — Info Experts', html: `<p>Bonjour ${name},</p><p>Votre message a bien été reçu.</p><p>Nous vous répondrons dans les meilleurs délais.</p>`, text: `Bonjour ${name},\n\nVotre message a bien été reçu.\n\nNous vous répondrons dans les meilleurs délais.` });
}

async function sendContactAdminNotification({ name, email, message }) {
  return sendEmail({ to: EMAIL_ADMIN_TO, subject: `[Contact] ${name}`, html: `<p>De : ${name} (${email})</p><p>${message}</p>`, text: `De : ${name}\n${email}\n\n${message}` });
}

async function sendOrderConfirmation({ order, items }) {
  if (!isValidEmail(order.customer_email)) return { skipped: true };
  const num = (order.id||'').split('-')[0].toUpperCase();
  return sendEmail({ to: order.customer_email, subject: `Confirmation commande #${num} — Boutique Info Experts`, html: `<p>Bonjour ${order.customer_name},</p><p>Votre commande #${num} a bien été enregistrée.</p>`, text: `Commande #${num} enregistrée.` });
}

async function sendOrderAdminNotification({ order, items }) {
  const num = (order.id||'').split('-')[0].toUpperCase();
  return sendEmail({ to: EMAIL_ADMIN_TO, subject: `[Commande] #${num} — ${order.customer_name}`, html: `<p>Commande #${num} de ${order.customer_name}.</p>`, text: `Commande #${num}` });
}

function baseTemplate({ title, content }) { return `<html><body>${content}</body></html>`; }

module.exports = { sendEmail, sendContactConfirmation, sendContactAdminNotification, sendOrderConfirmation, sendOrderAdminNotification, logEmail, isValidEmail, baseTemplate };
