// api/_lib/coupon-validate.js
// Validation partagée d'un code promo (utilisée par coupons.js et orders.js)
const { supabase } = require('./supabase');

const EUR_TO_KMF = 491;

/**
 * Valide un code promo pour un montant de commande donné.
 * @param {string} code
 * @param {number} orderTotalEur
 * @returns {Promise<{error: string, status: number} | {coupon: object, discount_eur: number, discount_kmf: number}>}
 */
async function validateCoupon(code, orderTotalEur) {
  if (!code) return { error: 'code requis', status: 400 };
  const total = Number(orderTotalEur);
  if (isNaN(total) || total < 0) {
    return { error: 'order_total_eur doit être un nombre positif', status: 400 };
  }

  const { data: coupon, error } = await supabase
    .from('coupon_codes')
    .select('*')
    .eq('code', String(code).trim().toUpperCase())
    .eq('is_active', true)
    .single();

  if (error || !coupon) return { error: 'Code promo invalide ou inactif', status: 404 };

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { error: 'Code promo expiré', status: 400 };
  }
  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
    return { error: 'Code promo épuisé', status: 400 };
  }
  if (coupon.min_order_eur && total < coupon.min_order_eur) {
    return { error: `Commande minimum requise : ${coupon.min_order_eur} €`, status: 400 };
  }

  let discount_eur = 0;
  let discount_kmf = 0;
  if (coupon.type === 'percentage') {
    discount_eur = Math.round((total * coupon.value / 100) * 100) / 100;
    discount_kmf = Math.round(discount_eur * EUR_TO_KMF);
  } else if (coupon.type === 'fixed_eur') {
    discount_eur = Math.min(coupon.value, total);
    discount_kmf = Math.round(discount_eur * EUR_TO_KMF);
  } else if (coupon.type === 'fixed_kmf') {
    discount_kmf = coupon.value;
    discount_eur = Math.round((discount_kmf / EUR_TO_KMF) * 100) / 100;
  }

  return { coupon, discount_eur, discount_kmf };
}

module.exports = { validateCoupon, EUR_TO_KMF };
