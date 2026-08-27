// api/_lib/email-extra.js
// Emails conversion : retour en stock, suivi de statut commande, relance impayé.
const { sendEmail, logEmail, baseTemplate, ctaButton, infoBox, esc, formatPrice } = require('./email');

const SITE = 'https://boutique.info-experts.fr';

// ── Retour en stock ──────────────────────────────────────────────────────────
async function sendBackInStock({ product, email }) {
  const url = `${SITE}/produit.html?id=${encodeURIComponent(product.slug || product.legacy_id || product.id)}`;
  const subject = `✅ ${product.name} est de retour en stock !`;
  const html = baseTemplate({
    title: subject,
    preheader: 'Le produit que vous attendiez est disponible — quantités limitées.',
    content: `
      <p>Bonne nouvelle !</p>
      <p>Le produit que vous attendiez est <strong>de nouveau disponible</strong> :</p>
      ${infoBox([
        ['Produit', esc(product.name)],
        ['Prix', `${formatPrice(product.price_eur)} €`],
      ])}
      <p>Les stocks repartent vite — ne tardez pas.</p>
      ${ctaButton(url, 'Voir le produit')}
    `,
  });
  const result = await sendEmail({ to: email, subject, html });
  await logEmail({ eventType: 'back_in_stock', recipientEmail: email, subject, status: result.success ? 'sent' : (result.skipped ? 'skipped' : 'failed'), errorMsg: result.error });
  return result;
}

// ── Suivi de statut commande ─────────────────────────────────────────────────
const STATUS_INFO = {
  confirmed: { emoji: '✅', label: 'confirmée',  msg: 'Votre commande est confirmée et en cours de préparation.' },
  shipped:   { emoji: '📦', label: 'expédiée',   msg: 'Votre commande est en route ! Nous vous contactons pour la remise.' },
  delivered: { emoji: '🎉', label: 'livrée',     msg: 'Votre commande a été livrée. Merci pour votre confiance !' },
  cancelled: { emoji: '↩️', label: 'annulée',    msg: 'Votre commande a été annulée. Contactez-nous pour toute question.' },
};

async function sendOrderStatusUpdate({ order, newStatus }) {
  const info = STATUS_INFO[newStatus];
  const to = order.customer_email;
  if (!info || !to) return { skipped: true, reason: !info ? 'status_non_notifiable' : 'no_email' };

  const orderNum = String(order.id).split('-')[0].toUpperCase();
  const subject = `${info.emoji} Commande #${orderNum} ${info.label} — Boutique Info Experts`;
  const html = baseTemplate({
    title: subject,
    preheader: info.msg,
    content: `
      <p>Bonjour ${esc(order.customer_name || '')},</p>
      <p>${info.msg}</p>
      ${infoBox([
        ['Commande', `#${orderNum}`],
        ['Statut', `${info.emoji} ${info.label.charAt(0).toUpperCase() + info.label.slice(1)}`],
        ['Total', `${formatPrice(order.total_eur)} €`],
      ])}
      <p>Une question ? Répondez à cet email ou contactez-nous au <strong>+269 477 78 65</strong> (WhatsApp).</p>
    `,
  });
  const result = await sendEmail({ to, subject, html });
  await logEmail({ eventType: `order_status_${newStatus}`, recipientEmail: to, subject, status: result.success ? 'sent' : (result.skipped ? 'skipped' : 'failed'), orderId: order.id, errorMsg: result.error });
  return result;
}

// ── Relance commande non payée ───────────────────────────────────────────────
async function sendPaymentReminder({ order, payUrl }) {
  const to = order.customer_email;
  if (!to) return { skipped: true, reason: 'no_email' };

  const orderNum = String(order.id).split('-')[0].toUpperCase();
  const subject = `🛒 Votre commande #${orderNum} vous attend — Boutique Info Experts`;
  const html = baseTemplate({
    title: subject,
    preheader: 'Votre panier est réservé — finalisez votre paiement en 2 minutes.',
    content: `
      <p>Bonjour ${esc(order.customer_name || '')},</p>
      <p>Votre commande est prête mais le paiement n'a pas été finalisé. Elle vous attend :</p>
      ${infoBox([
        ['Commande', `#${orderNum}`],
        ['Total', `${formatPrice(order.total_eur)} €`],
      ])}
      ${ctaButton(payUrl, 'Finaliser mon paiement')}
      <p style="font-size:13px;color:#64748b">Vous préférez payer en Mobile Money ou en espèces au retrait ?
      Répondez simplement à cet email ou écrivez-nous au <strong>+269 477 78 65</strong>.</p>
    `,
  });
  const result = await sendEmail({ to, subject, html });
  await logEmail({ eventType: 'payment_reminder', recipientEmail: to, subject, status: result.success ? 'sent' : (result.skipped ? 'skipped' : 'failed'), orderId: order.id, errorMsg: result.error });
  return result;
}

module.exports = { sendBackInStock, sendOrderStatusUpdate, sendPaymentReminder };
