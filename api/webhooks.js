'use strict';
// ── Webhooks Stripe — Boutique Info Experts ───────────────────────────────────
// Route : POST /api/webhooks/stripe
// Vérifie la signature Stripe avant tout traitement.
// Évènements gérés :
//   payment_intent.succeeded          → licence one_time / license
//   checkout.session.completed        → commande confirmée (fallback)
//   invoice.payment_succeeded         → renouvellement abonnement
//   customer.subscription.deleted     → annulation abonnement → révoque licence
//   invoice.payment_failed            → paiement échoué → notif email
//
// IMPORTANT : Vercel lit le body comme Buffer uniquement si bodyParser est désactivé.
// Cette fonction désactive bodyParser via `config.api.bodyParser = false`.

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { sendEmail, isValidEmail } = require('./_lib/email');

// bodyParser désactivé — voir handler.config en fin de fichier

// ─── Helpers ──────────────────────────────────────────────────────────────────
function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(data);
}

// Lire le body brut depuis le stream (requis pour la vérification sig Stripe)
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Générer une clé de licence (identique à api/digital.js)
function generateLicenseKey() {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf   = crypto.randomBytes(25);
  let key = '';
  for (let i = 0; i < 25; i++) {
    key += CHARS[buf[i] % CHARS.length];
    if (i < 24 && (i + 1) % 5 === 0) key += '-';
  }
  return key;
}

// Vérifier la signature Stripe (HMAC-SHA256 sur raw body)
function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return null;
  const parts     = sigHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});
  const timestamp = parts['t'];
  const v1        = parts['v1'];
  if (!timestamp || !v1) return null;

  // Protection contre les replays : rejet si > 5 minutes
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return null;

  const payload  = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const isValid  = crypto.timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'));
  if (!isValid) return null;

  return JSON.parse(rawBody.toString('utf8'));
}

// ─── Email notification licence ───────────────────────────────────────────────
async function sendLicenseEmail({ to, name, productName, licenseKey, expiresAt }) {
  if (!isValidEmail(to)) return;
  const expStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Illimitée';
  const subject  = `Votre licence ${productName} — Boutique Info Experts`;
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="background-color:#1e3a8a;background-image:linear-gradient(135deg,#0f2460 0%,#1e3a8a 60%,#1a3a8f 100%);padding:28px 36px;border-radius:12px 12px 0 0">
  <p style="margin:0;font-size:12px;color:#93c5fd;text-transform:uppercase;letter-spacing:2.5px;font-weight:700">Boutique Officielle</p>
  <p style="margin:4px 0 0;font-size:26px;font-weight:900;color:#fff">Info&nbsp;<span style="color:#f59e0b">Experts</span></p>
</td></tr>
<tr><td style="background:#fff;padding:36px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
  <p style="margin:0 0 4px;font-size:13px;color:#6b7280;font-weight:600">Bonjour ${name || 'Client'},</p>
  <h1 style="margin:8px 0 20px;font-size:22px;font-weight:800;color:#0f172a;line-height:1.3">Votre licence est prête ✓</h1>
  <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7">Votre achat de <strong>${productName}</strong> a été confirmé. Voici votre clé de licence :</p>
  <div style="background:#f8fafc;border:2px dashed #1e3a8a;border-radius:8px;padding:20px;text-align:center;margin:20px 0">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Clé de licence</p>
    <p style="margin:0;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:3px;font-family:monospace">${licenseKey}</p>
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin:16px 0">
    <tr><td style="padding:9px 12px;background:#f8fafc;font-size:12px;color:#4b5563;font-weight:600;width:40%;border-bottom:1px solid #e5e7eb">Produit</td><td style="padding:9px 12px;background:#fff;font-size:13px;color:#1f2937;border-bottom:1px solid #e5e7eb">${productName}</td></tr>
    <tr><td style="padding:9px 12px;background:#f8fafc;font-size:12px;color:#4b5563;font-weight:600;border-bottom:1px solid #e5e7eb">Expiration</td><td style="padding:9px 12px;background:#fff;font-size:13px;color:#1f2937;border-bottom:1px solid #e5e7eb">${expStr}</td></tr>
  </table>
  <div style="background:#eff6ff;border-left:4px solid #1e3a8a;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0">
    <p style="margin:0;font-size:13px;color:#374151">Conservez cette clé en lieu sûr. Connectez-vous sur <a href="https://boutique.info-experts.fr/compte.html" style="color:#1e3a8a;font-weight:600">votre compte</a> pour retrouver vos licences à tout moment.</p>
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr><td>
    <a href="https://boutique.info-experts.fr/compte.html" style="background:#f59e0b;color:#0f172a;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;display:inline-block">Accéder à mes licences →</a>
  </td></tr></table>
</td></tr>
<tr><td style="background:#0a0f1e;padding:24px 36px;border-radius:0 0 12px 12px">
  <p style="margin:0;color:#9ca3af;font-size:12px">📞 <a href="tel:+2697772722" style="color:#9ca3af;text-decoration:none">+269 777 27 22</a> · 📧 <a href="mailto:contact@info-experts.fr" style="color:#60a5fa;text-decoration:none">contact@info-experts.fr</a></p>
  <p style="margin:12px 0 0;padding-top:12px;border-top:1px solid #1f2937;color:#9ca3af;font-size:10px;text-align:center">&copy; 2026 Info Experts · Boutique informatique aux Comores</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
  const text = `Bonjour ${name || 'Client'},\n\nVotre licence ${productName} est prête.\nClé : ${licenseKey}\nExpiration : ${expStr}\n\nConnectez-vous sur https://boutique.info-experts.fr/compte.html\n\nInfo Experts · contact@info-experts.fr · +269 777 27 22`;
  await sendEmail({ to, subject, html, text });
}

// ─── Gestionnaire principal ────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST uniquement' });

  const rawBody  = await readRawBody(req);
  const sigHeader = req.headers['stripe-signature'];
  const secret    = process.env.STRIPE_WEBHOOK_SECRET;

  const event = verifyStripeSignature(rawBody, sigHeader, secret);
  if (!event) {
    console.error('[webhook] Signature Stripe invalide');
    return json(res, 400, { error: 'Signature invalide' });
  }

  const sb = supabaseAdmin();
  console.log('[webhook] Évènement reçu:', event.type, event.id);

  try {
    switch (event.type) {

      // ── Paiement one-time confirmé → générer licence ───────────────────────
      case 'payment_intent.succeeded': {
        const pi       = event.data.object;
        const meta     = pi.metadata || {};
        const email    = meta.customer_email || pi.receipt_email;
        const productId = meta.product_id;
        if (!email || !productId) break;

        const { data: prod } = await sb
          .from('products')
          .select('id,name,product_type,billing_period,max_devices,specs')
          .eq('id', productId).single();
        if (!prod) break;

        if (prod.product_type === 'one_time' || prod.product_type === 'license') {
          const key = generateLicenseKey();
          const { data: lic } = await sb.from('digital_licenses').insert({
            product_id:    productId,
            customer_email: email.toLowerCase(),
            license_key:   key,
            max_devices:   prod.max_devices || 1,
            status:        'active',
          }).select().single();

          // Mettre à jour la commande si stripe_session_id présent
          if (meta.order_id) {
            await sb.from('orders')
              .update({ payment_status: 'paid' })
              .eq('id', meta.order_id);
          }

          await sendLicenseEmail({
            to:          email,
            name:        meta.customer_name,
            productName: prod.name,
            licenseKey:  key,
            expiresAt:   null,
          });
          console.log('[webhook] Licence générée:', key, 'pour', email);
        }
        break;
      }

      // ── Session Stripe Checkout complétée (fallback paiement one-time) ─────
      case 'checkout.session.completed': {
        const session  = event.data.object;
        const email    = session.customer_details?.email || session.customer_email;
        const meta     = session.metadata || {};
        if (!email || !meta.product_id) break;
        if (session.payment_status !== 'paid') break;

        const { data: prod } = await sb
          .from('products')
          .select('id,name,product_type,max_devices')
          .eq('id', meta.product_id).single();
        if (!prod) break;

        if (prod.product_type === 'one_time' || prod.product_type === 'license') {
          // Évite le doublon si payment_intent.succeeded a déjà créé la licence
          const { data: existing } = await sb
            .from('digital_licenses')
            .select('id')
            .eq('product_id', meta.product_id)
            .eq('customer_email', email.toLowerCase())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (existing) break;

          const key = generateLicenseKey();
          await sb.from('digital_licenses').insert({
            product_id:     meta.product_id,
            customer_email: email.toLowerCase(),
            license_key:    key,
            max_devices:    prod.max_devices || 1,
            status:         'active',
          });
          await sendLicenseEmail({
            to:          email,
            name:        session.customer_details?.name,
            productName: prod.name,
            licenseKey:  key,
          });
        }
        break;
      }

      // ── Renouvellement abonnement payé ─────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subId   = invoice.subscription;
        if (!subId) break;

        const periodStart = new Date(invoice.period_start * 1000).toISOString();
        const periodEnd   = new Date(invoice.period_end   * 1000).toISOString();

        await sb.from('digital_subscriptions')
          .update({
            status:               'active',
            current_period_start: periodStart,
            current_period_end:   periodEnd,
            updated_at:           new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subId);
        break;
      }

      // ── Abonnement annulé → révoquer la licence ────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await sb.from('digital_subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);

        // Récupère les licences liées à cet abonnement
        const { data: subs } = await sb
          .from('digital_subscriptions')
          .select('product_id,customer_email')
          .eq('stripe_subscription_id', sub.id)
          .limit(1)
          .single();
        if (subs) {
          await sb.from('digital_licenses')
            .update({ status: 'revoked' })
            .eq('product_id', subs.product_id)
            .eq('customer_email', subs.customer_email)
            .eq('status', 'active');
        }
        break;
      }

      // ── Paiement échoué → email de notification ────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const email   = invoice.customer_email;
        if (!isValidEmail(email)) break;

        const subject = 'Paiement échoué — Boutique Info Experts';
        const text    = `Votre paiement pour votre abonnement Info Experts a échoué.\nMettez à jour vos informations de paiement sur : https://boutique.info-experts.fr/compte.html\n\nInfo Experts · contact@info-experts.fr`;
        await sendEmail({ to: email, subject, html: `<p>${text.replace(/\n/g, '<br>')}</p>`, text });
        break;
      }

      default:
        console.log('[webhook] Évènement ignoré:', event.type);
    }

    return json(res, 200, { received: true });

  } catch (e) {
    console.error('[webhook] Erreur traitement:', event.type, e.message);
    return json(res, 500, { error: 'Erreur traitement' });
  }
};

// Config Vercel : désactiver bodyParser pour recevoir le raw body Stripe
module.exports.config = { api: { bodyParser: false } };
