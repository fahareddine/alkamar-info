'use strict';
// ── Service email centralisé — Boutique Info Experts ──────────────────────────
// Appelle l'API REST Resend via https natif (pas de dépendance npm).
// En mode test (EMAIL_TEST_MODE=true), redirige vers EMAIL_TEST_RECIPIENT.
// Si RESEND_API_KEY absent ou placeholder → log uniquement, aucun envoi.

const https = require('https');

// ─── Config ───────────────────────────────────────────────────────────────────
const EMAIL_FROM     = process.env.EMAIL_FROM     || 'Info Experts <noreply@info-experts.fr>';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || 'contact@info-experts.fr';
const EMAIL_ADMIN_TO = process.env.EMAIL_ADMIN_TO || 'contact@info-experts.fr';
const TEST_MODE      = process.env.EMAIL_TEST_MODE === 'true';
const TEST_RECIPIENT = process.env.EMAIL_TEST_RECIPIENT || '';

// ─── Appel REST Resend (sans SDK) ────────────────────────────────────────────
function resendRequest(payload, apiKey) {
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch (e) { reject(new Error('Resend JSON parse: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Resend timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || ''));
}

function formatPrice(eur) {
  return Number(eur || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Base send ────────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey || apiKey.startsWith('re_VOTRE')) {
    console.log('[email] RESEND_API_KEY non configurée — email ignoré:', subject, '→', to);
    return { skipped: true, reason: 'no_api_key' };
  }
  if (!to || !isValidEmail(to)) {
    console.warn('[email] Destinataire invalide — email ignoré:', to);
    return { skipped: true, reason: 'invalid_recipient' };
  }

  const recipient = (TEST_MODE && TEST_RECIPIENT) ? TEST_RECIPIENT : to;
  const finalSubj = TEST_MODE ? `[TEST] ${subject}` : subject;

  try {
    const result = await resendRequest({
      from:     EMAIL_FROM,
      reply_to: EMAIL_REPLY_TO,
      to:       [recipient],
      subject:  finalSubj,
      html,
      text:     text || stripHtml(html),
    }, apiKey);

    if (result.status >= 400) {
      console.error('[email] Resend erreur HTTP:', result.status, JSON.stringify(result.data).slice(0, 200));
      return { success: false, error: result.data?.message || `HTTP ${result.status}` };
    }
    console.log('[email] Envoyé:', finalSubj, '→', recipient, '| id:', result.data?.id);
    return { success: true, id: result.data?.id };
  } catch (err) {
    console.error('[email] Erreur envoi:', finalSubj, '—', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Log Supabase (non bloquant) ──────────────────────────────────────────────
async function logEmail({ eventType, recipientEmail, subject, status, providerId, orderId, contactId, errorMsg }) {
  try {
    const { supabase } = require('./supabase');
    await supabase.from('email_logs').insert({
      event_type:          eventType,
      recipient_email:     recipientEmail,
      subject,
      status:              status || 'sent',
      provider_message_id: providerId || null,
      related_order_id:    orderId   || null,
      related_contact_id:  contactId || null,
      error_message:       errorMsg  || null,
    });
  } catch (e) {
    console.warn('[email] logEmail failed (table manquante ?):', e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── TEMPLATE BASE ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function baseTemplate({ title, preheader, content }) {
  return `<!DOCTYPE html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(title)}</title>
<!--[if mso]><style>table{border-collapse:collapse}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2f5">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">

<!-- ── HEADER ── -->
<tr><td style="background:linear-gradient(135deg,#0f2460 0%,#1e3a8a 60%,#1a3a8f 100%);padding:28px 36px;border-radius:12px 12px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
  <td valign="middle">
    <p style="margin:0;font-size:10px;color:#93c5fd;text-transform:uppercase;letter-spacing:2.5px;font-weight:700">Boutique Officielle</p>
    <p style="margin:4px 0 0;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px">Info&nbsp;<span style="color:#f59e0b">Experts</span></p>
  </td>
  <td align="right" valign="top">
    <p style="margin:0;font-size:10px;color:#93c5fd;line-height:1.8">Moroni, Comores<br><a href="https://boutique.info-experts.fr" style="color:#60a5fa;text-decoration:none;font-size:10px">boutique.info-experts.fr</a></p>
  </td>
</tr>
</table>
</td></tr>

<!-- ── CONTENT ── -->
<tr><td style="background:#ffffff;padding:36px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
${content}
</td></tr>

<!-- ── FOOTER ── -->
<tr><td style="background:#0a0f1e;padding:24px 36px;border-radius:0 0 12px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
  <td valign="top" style="padding-right:16px">
    <p style="margin:0 0 6px;color:#e2e8f0;font-size:13px;font-weight:700">Info Experts</p>
    <p style="margin:0 0 3px;color:#9ca3af;font-size:11px">&#128222; <a href="tel:+2697772722" style="color:#9ca3af;text-decoration:none">+269 777 27 22</a></p>
    <p style="margin:0 0 3px;color:#9ca3af;font-size:11px">&#128231; <a href="mailto:contact@info-experts.fr" style="color:#60a5fa;text-decoration:none">contact@info-experts.fr</a></p>
    <p style="margin:0;color:#9ca3af;font-size:11px">&#128205; Moroni, Grande Comore, Comores</p>
  </td>
  <td align="right" valign="top">
    <p style="margin:0 0 8px"><a href="https://boutique.info-experts.fr" style="color:#60a5fa;font-size:12px;text-decoration:none;font-weight:600">&#128722; Boutique</a></p>
    <p style="margin:0"><a href="https://info-experts.fr" style="color:#94a3b8;font-size:11px;text-decoration:none">info-experts.fr</a></p>
  </td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:1px solid #1f2937;padding-top:12px">
<tr><td>
  <p style="margin:0;color:#4b5563;font-size:10px;text-align:center">&copy; 2026 Info Experts &middot; Boutique informatique aux Comores &middot; Tous droits r&eacute;serv&eacute;s<br>
  <a href="https://boutique.info-experts.fr/mentions-legales.html" style="color:#4b5563;text-decoration:none">Mentions l&eacute;gales</a> &middot; <a href="https://boutique.info-experts.fr/cgv.html" style="color:#4b5563;text-decoration:none">CGV</a></p>
</td></tr>
</table>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function ctaButton(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">
<tr><td>
  <a href="${href}" style="background:#f59e0b;color:#0f172a;padding:13px 28px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;display:inline-block;letter-spacing:0.3px">${esc(label)} &#8594;</a>
</td></tr>
</table>`;
}

function infoBox(rows) {
  const cells = rows.filter(Boolean).map(([label, value]) => `<tr>
    <td style="padding:8px 12px;background:#f8fafc;font-size:12px;color:#6b7280;font-weight:600;width:35%;border-bottom:1px solid #e5e7eb;vertical-align:top">${esc(label)}</td>
    <td style="padding:8px 12px;background:#ffffff;font-size:13px;color:#1f2937;border-bottom:1px solid #e5e7eb">${esc(value)}</td>
  </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:16px 0">${cells}</table>`;
}

function sectionHeading(text) {
  return `<p style="margin:24px 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280">${esc(text)}</p>`;
}

function nextSteps(steps) {
  const items = steps.map((s, i) =>
    `<tr><td valign="top" style="padding:4px 0">
      <span style="display:inline-block;width:20px;height:20px;background:#1e3a8a;color:#fff;border-radius:50%;font-size:10px;font-weight:700;text-align:center;line-height:20px;margin-right:8px">${i + 1}</span><span style="font-size:13px;color:#374151">${esc(s)}</span>
    </td></tr>`).join('');
  return `<div style="background:#eff6ff;border-left:4px solid #1e3a8a;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0">
    <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a">&#128203; Prochaines &eacute;tapes</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">${items}</table>
  </div>`;
}

function orderItemsTable(items) {
  const rows = (items || []).map(item => `<tr>
    <td style="padding:10px 12px;font-size:13px;color:#1f2937;border-bottom:1px solid #f1f5f9">${esc(item.product_name || item.name || 'Produit')}</td>
    <td style="padding:10px 12px;font-size:13px;color:#6b7280;text-align:center;border-bottom:1px solid #f1f5f9">${item.quantity || 1}</td>
    <td style="padding:10px 12px;font-size:13px;color:#1f2937;text-align:right;border-bottom:1px solid #f1f5f9;font-weight:600;white-space:nowrap">${formatPrice(item.price_eur)} &euro;</td>
  </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:12px 0">
    <tr style="background:#1e3a8a">
      <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#ffffff;text-align:left;text-transform:uppercase;letter-spacing:1px">Article</th>
      <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#ffffff;text-align:center;text-transform:uppercase;letter-spacing:1px;width:50px">Qt&eacute;</th>
      <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#ffffff;text-align:right;text-transform:uppercase;letter-spacing:1px;white-space:nowrap">Prix unit.</th>
    </tr>
    ${rows}
  </table>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── CONFIRMATION CONTACT CLIENT ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
async function sendContactConfirmation({ name, email, message, subject: contactSubject, phone }) {
  if (!isValidEmail(email)) return { skipped: true, reason: 'invalid_email' };

  const subject   = 'Votre message a bien été reçu — Info Experts';
  const preheader = `Bonjour ${name}, nous avons bien reçu votre message et vous répondrons dans les meilleurs délais.`;

  const content = `
<p style="margin:0 0 4px;font-size:13px;color:#6b7280;font-weight:600">Bonjour ${esc(name)},</p>
<h1 style="margin:8px 0 20px;font-size:22px;font-weight:800;color:#0f172a;line-height:1.3">Votre message a bien &eacute;t&eacute; re&ccedil;u &#10003;</h1>
<p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7">Merci de nous avoir contact&eacute;s. Notre &eacute;quipe a bien re&ccedil;u votre message et vous r&eacute;pondra dans les <strong>meilleurs d&eacute;lais</strong>, g&eacute;n&eacute;ralement sous 24&ndash;48 heures.</p>

${sectionHeading('Récapitulatif de votre message')}
${infoBox([
    ['Nom', name],
    contactSubject ? ['Sujet', contactSubject] : null,
    phone ? ['Téléphone', phone] : null,
    ['Email', email],
    ['Message', message.slice(0, 400) + (message.length > 400 ? '…' : '')],
  ].filter(Boolean))}

${nextSteps([
    'Notre équipe examine votre demande.',
    'Vous recevrez une réponse par email sous 24–48h.',
    'Pour toute urgence, contactez-nous directement sur WhatsApp.',
  ])}

<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0">
  <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:1px">&#128241; Contact rapide</p>
  <p style="margin:0;font-size:13px;color:#374151">WhatsApp : <a href="https://wa.me/2697772722" style="color:#1e3a8a;font-weight:600;text-decoration:none">+269 777 27 22</a></p>
</div>

${ctaButton('https://boutique.info-experts.fr', 'Découvrir la boutique')}

<p style="margin:24px 0 0;font-size:11px;color:#9ca3af;border-top:1px solid #f1f5f9;padding-top:16px">Info Experts &middot; Boutique informatique officielle aux Comores &middot; <a href="mailto:contact@info-experts.fr" style="color:#6b7280;text-decoration:none">contact@info-experts.fr</a></p>`;

  const html = baseTemplate({ title: subject, preheader, content });
  const text = `Bonjour ${name},\n\nVotre message a bien été reçu.\n\nNous vous répondrons dans les meilleurs délais (24-48h).\n\nRécapitulatif :\n- Email : ${email}${phone ? `\n- Téléphone : ${phone}` : ''}\n- Message : ${message}\n\nProchaines étapes :\n1. Notre équipe examine votre demande.\n2. Vous recevrez une réponse par email sous 24-48h.\n3. Pour toute urgence : WhatsApp +269 777 27 22\n\nBoutique Info Experts\nhttps://boutique.info-experts.fr\ncontact@info-experts.fr\n+269 777 27 22\nMoroni, Grande Comore, Comores`;

  const result = await sendEmail({ to: email, subject, html, text });
  await logEmail({ eventType: 'contact_confirmation', recipientEmail: email, subject, status: result.success ? 'sent' : (result.skipped ? 'skipped' : 'failed'), errorMsg: result.error });
  return result;
}

// ─── NOTIFICATION ADMIN — CONTACT ─────────────────────────────────────────────
async function sendContactAdminNotification({ name, email, message, subject: contactSubject, phone, source, contactId }) {
  const subject   = `[Contact] Nouveau message de ${name}`;
  const preheader = `${name} (${email || 'sans email'}) vient d'envoyer un message depuis ${source || 'la boutique'}.`;

  const content = `
<h2 style="margin:0 0 20px;font-size:18px;font-weight:800;color:#0f172a">&#128276; Nouveau contact re&ccedil;u</h2>

${sectionHeading('Informations client')}
${infoBox([
    ['Nom', name],
    ['Email', email || 'Non fourni'],
    phone ? ['Téléphone', phone] : null,
    contactSubject ? ['Sujet', contactSubject] : null,
    ['Source', source || 'Formulaire boutique'],
    ['Date', new Date().toLocaleString('fr-FR', { timeZone: 'Indian/Comoro', dateStyle: 'short', timeStyle: 'short' })],
  ].filter(Boolean))}

${sectionHeading('Message')}
<div style="background:#f8fafc;border-left:3px solid #f59e0b;padding:16px 20px;margin:0 0 20px;border-radius:0 8px 8px 0;font-size:13px;color:#374151;line-height:1.7;white-space:pre-wrap">${esc(message)}</div>

${email ? ctaButton('mailto:' + email + '?subject=Re%3A Votre message — Info Experts', 'Répondre au client') : ''}`;

  const html = baseTemplate({ title: subject, preheader, content });
  const text = `Nouveau contact\n\nNom : ${name}\nEmail : ${email || 'Non fourni'}${phone ? `\nTéléphone : ${phone}` : ''}\nSource : ${source || 'Formulaire boutique'}\n\nMessage :\n${message}`;

  const result = await sendEmail({ to: EMAIL_ADMIN_TO, subject, html, text });
  await logEmail({ eventType: 'contact_admin_notification', recipientEmail: EMAIL_ADMIN_TO, subject, status: result.success ? 'sent' : (result.skipped ? 'skipped' : 'failed'), contactId, errorMsg: result.error });
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── CONFIRMATION COMMANDE CLIENT ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
async function sendOrderConfirmation({ order, items }) {
  const email = order.customer_email;
  if (!isValidEmail(email)) return { skipped: true, reason: 'no_email' };

  const name       = order.customer_name || 'Client';
  const orderNum   = (order.id || '').split('-')[0].toUpperCase();
  const pmLabels   = { stripe: 'Carte bancaire (Stripe)', mobile_money: 'Mobile Money', cash_pickup: 'Paiement en boutique', cash_delivery: 'Paiement à la livraison' };
  const pmLabel    = pmLabels[order.payment_method] || order.payment_method || 'Non précisé';
  const delivLabel = order.delivery_method === 'home_delivery' ? 'Livraison à domicile' : 'Retrait en boutique — Moroni';
  const dateStr    = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const subject   = `Confirmation commande #${orderNum} — Boutique Info Experts`;
  const preheader = `Bonjour ${name}, votre commande #${orderNum} a bien été enregistrée. Total : ${formatPrice(order.total_eur)} €`;

  const mobileMoneyBlock = order.payment_method === 'mobile_money' ? `
<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px 20px;margin:16px 0">
  <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px">&#128179; Instructions paiement Mobile Money</p>
  <p style="margin:0 0 4px;font-size:13px;color:#374151">Num&eacute;ro : <strong>+269 331 27 22</strong></p>
  <p style="margin:0 0 4px;font-size:13px;color:#374151">Nom : <strong>Info Experts</strong></p>
  <p style="margin:0;font-size:13px;color:#374151">R&eacute;f&eacute;rence : <strong>#${orderNum}</strong></p>
</div>` : '';

  const steps = [
    'Notre équipe vérifie la disponibilité de vos articles.',
    order.payment_method === 'mobile_money'
      ? `Effectuez le paiement Mobile Money avec la référence #${orderNum}.`
      : order.payment_method === 'stripe'
        ? 'Votre paiement par carte est en attente de confirmation.'
        : 'Un conseiller vous contactera pour confirmer votre commande.',
    order.delivery_method === 'home_delivery'
      ? 'Vous serez contacté pour organiser la livraison à votre adresse.'
      : 'Rendez-vous en boutique à Moroni pour récupérer votre commande.',
  ];

  const content = `
<p style="margin:0 0 4px;font-size:13px;color:#6b7280;font-weight:600">Bonjour ${esc(name)},</p>
<h1 style="margin:8px 0 20px;font-size:22px;font-weight:800;color:#0f172a;line-height:1.3">Votre commande est enregistr&eacute;e &#10003;</h1>
<p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7">Merci pour votre commande sur <strong>Boutique Info Experts</strong>. Votre demande a bien &eacute;t&eacute; re&ccedil;ue et notre &eacute;quipe va la traiter rapidement.</p>

${sectionHeading('Détails de la commande')}
${infoBox([
    ['N° de commande', `#${orderNum}`],
    ['Date', dateStr],
    ['Livraison', delivLabel],
    order.delivery_city ? ['Ville', order.delivery_city] : null,
    order.delivery_address ? ['Adresse', order.delivery_address] : null,
    ['Paiement', pmLabel],
  ].filter(Boolean))}

${items && items.length ? sectionHeading('Articles commandés') + orderItemsTable(items) : ''}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0">
  <tr>
    <td style="font-size:13px;color:#6b7280;font-weight:600;padding:8px 0;border-top:2px solid #e5e7eb">Sous-total</td>
    <td style="text-align:right;font-size:13px;color:#1f2937;font-weight:600;padding:8px 0;border-top:2px solid #e5e7eb">${formatPrice(order.subtotal_eur || order.total_eur)} &euro;</td>
  </tr>
  ${order.delivery_fee > 0 ? `<tr>
    <td style="font-size:13px;color:#6b7280;padding:4px 0">Livraison</td>
    <td style="text-align:right;font-size:13px;color:#1f2937;padding:4px 0">${formatPrice(order.delivery_fee)} &euro;</td>
  </tr>` : ''}
  <tr>
    <td style="font-size:15px;font-weight:800;color:#0f172a;padding:10px 0;border-top:2px solid #0f172a">Total</td>
    <td style="text-align:right;font-size:15px;font-weight:800;color:#dc2626;padding:10px 0;border-top:2px solid #0f172a;white-space:nowrap">${formatPrice(order.total_eur)} &euro; <span style="font-size:11px;color:#6b7280;font-weight:400">(&asymp;&nbsp;${Math.round((Number(order.total_eur) || 0) * 491).toLocaleString('fr-FR')}&nbsp;KMF)</span></td>
  </tr>
</table>

${mobileMoneyBlock}
${nextSteps(steps)}

<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0">
  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:1px">&#128241; Besoin d'aide ?</p>
  <p style="margin:0;font-size:13px;color:#374151">WhatsApp : <a href="https://wa.me/2697772722?text=Commande+%23${orderNum}" style="color:#1e3a8a;font-weight:600;text-decoration:none">+269 777 27 22</a></p>
</div>

${ctaButton('https://boutique.info-experts.fr', 'Continuer mes achats')}

<p style="margin:24px 0 0;font-size:11px;color:#9ca3af;border-top:1px solid #f1f5f9;padding-top:16px">Info Experts &middot; Boutique informatique officielle aux Comores &middot; <a href="mailto:contact@info-experts.fr" style="color:#6b7280;text-decoration:none">contact@info-experts.fr</a></p>`;

  const html = baseTemplate({ title: subject, preheader, content });
  const itemsText = (items || []).map(i => `- ${i.product_name || i.name} x${i.quantity} : ${formatPrice(i.price_eur)} €`).join('\n');
  const text = `Bonjour ${name},\n\nVotre commande #${orderNum} est enregistrée !\nTotal : ${formatPrice(order.total_eur)} € (≈ ${Math.round((Number(order.total_eur)||0)*491).toLocaleString('fr-FR')} KMF)\nDate : ${dateStr}\nLivraison : ${delivLabel}\nPaiement : ${pmLabel}\n\n${itemsText}\n\nBoutique Info Experts\nhttps://boutique.info-experts.fr\ncontact@info-experts.fr\n+269 777 27 22\nMoroni, Grande Comore, Comores`;

  const result = await sendEmail({ to: email, subject, html, text });
  await logEmail({ eventType: 'order_confirmation', recipientEmail: email, subject, status: result.success ? 'sent' : (result.skipped ? 'skipped' : 'failed'), orderId: order.id, errorMsg: result.error });
  return result;
}

// ─── NOTIFICATION ADMIN — COMMANDE ────────────────────────────────────────────
async function sendOrderAdminNotification({ order, items }) {
  const name     = order.customer_name || 'Client inconnu';
  const email    = order.customer_email || 'Non fourni';
  const orderNum = (order.id || '').split('-')[0].toUpperCase();

  const subject   = `[Commande] #${orderNum} — ${name} — ${formatPrice(order.total_eur)} €`;
  const preheader = `Nouvelle commande de ${name}. Total : ${formatPrice(order.total_eur)} € via ${order.payment_method}.`;

  const content = `
<h2 style="margin:0 0 20px;font-size:18px;font-weight:800;color:#0f172a">&#128722; Nouvelle commande re&ccedil;ue</h2>

${sectionHeading('Client')}
${infoBox([
    ['Nom', name],
    ['Email', email],
    order.customer_whatsapp ? ['WhatsApp', order.customer_whatsapp] : null,
    order.customer_phone ? ['Téléphone', order.customer_phone] : null,
  ].filter(Boolean))}

${sectionHeading('Commande')}
${infoBox([
    ['N° commande', `#${orderNum}`],
    ['Date', new Date().toLocaleString('fr-FR', { timeZone: 'Indian/Comoro', dateStyle: 'short', timeStyle: 'short' })],
    ['Montant', `${formatPrice(order.total_eur)} € (${Math.round((Number(order.total_eur)||0)*491).toLocaleString('fr-FR')} KMF)`],
    ['Livraison', order.delivery_method === 'home_delivery' ? 'Domicile' : 'Retrait boutique'],
    order.delivery_city ? ['Ville', order.delivery_city] : null,
    ['Paiement', order.payment_method || 'Non précisé'],
    ['Statut paiement', order.payment_status || 'pending'],
  ].filter(Boolean))}

${items && items.length ? sectionHeading('Articles') + orderItemsTable(items) : ''}

${ctaButton('https://boutique.info-experts.fr/admin/orders/index.html', 'Voir dans l\'admin')}`;

  const html = baseTemplate({ title: subject, preheader, content });
  const itemsText = (items || []).map(i => `- ${i.product_name || i.name} x${i.quantity}`).join('\n');
  const text = `Nouvelle commande #${orderNum}\n\nClient : ${name}\nEmail : ${email}${order.customer_whatsapp ? `\nWhatsApp : ${order.customer_whatsapp}` : ''}\n\nMontant : ${formatPrice(order.total_eur)} €\nPaiement : ${order.payment_method}\nLivraison : ${order.delivery_method === 'home_delivery' ? 'Domicile' : 'Retrait'}\n\n${itemsText}`;

  const result = await sendEmail({ to: EMAIL_ADMIN_TO, subject, html, text });
  await logEmail({ eventType: 'order_admin_notification', recipientEmail: EMAIL_ADMIN_TO, subject, status: result.success ? 'sent' : (result.skipped ? 'skipped' : 'failed'), orderId: order.id, errorMsg: result.error });
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
module.exports = {
  sendEmail,
  sendContactConfirmation,
  sendContactAdminNotification,
  sendOrderConfirmation,
  sendOrderAdminNotification,
  logEmail,
  isValidEmail,
  baseTemplate,
};
