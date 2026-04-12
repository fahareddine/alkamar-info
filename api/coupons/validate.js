// api/coupons/validate.js
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin', 'commercial');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { code, order_total_eur } = req.body;
  if (!code) return res.status(400).json({ error: 'code requis' });

  const { data: coupon, error } = await supabase
    .from('coupon_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error || !coupon) return res.status(404).json({ error: 'Code promo invalide ou inactif' });

  // Vérifications
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Code promo expiré' });
  }
  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
    return res.status(400).json({ error: 'Code promo épuisé' });
  }
  if (coupon.min_order_eur && order_total_eur < coupon.min_order_eur) {
    return res.status(400).json({
      error: `Commande minimum requise : ${coupon.min_order_eur} €`
    });
  }

  // Calculer le rabais
  let discount_eur = 0;
  let discount_kmf = 0;
  const EUR_TO_KMF = 491;

  if (coupon.type === 'percentage') {
    discount_eur = Math.round((order_total_eur * coupon.value / 100) * 100) / 100;
    discount_kmf = Math.round(discount_eur * EUR_TO_KMF);
  } else if (coupon.type === 'fixed_eur') {
    discount_eur = Math.min(coupon.value, order_total_eur);
    discount_kmf = Math.round(discount_eur * EUR_TO_KMF);
  } else if (coupon.type === 'fixed_kmf') {
    discount_kmf = coupon.value;
    discount_eur = Math.round((discount_kmf / EUR_TO_KMF) * 100) / 100;
  }

  return res.status(200).json({
    valid: true,
    coupon_code: coupon.code,
    discount_eur,
    discount_kmf
  });
};
