// api/coupons.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Route fusionnée : /api/coupons/validate → /api/coupons?_route=validate
  if (req.query._route === 'validate') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { code, order_total_eur } = req.body;
    if (!code) return res.status(400).json({ error: 'code requis' });

    const total = Number(order_total_eur);
    if (isNaN(total) || total < 0) {
      return res.status(400).json({ error: 'order_total_eur doit être un nombre positif' });
    }

    const { data: coupon, error } = await supabase
      .from('coupon_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !coupon) return res.status(404).json({ error: 'Code promo invalide ou inactif' });

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Code promo expiré' });
    }
    if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
      return res.status(400).json({ error: 'Code promo épuisé' });
    }
    if (coupon.min_order_eur && total < coupon.min_order_eur) {
      return res.status(400).json({ error: `Commande minimum requise : ${coupon.min_order_eur} €` });
    }

    let discount_eur = 0;
    let discount_kmf = 0;
    const EUR_TO_KMF = 491;

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

    return res.status(200).json({ valid: true, coupon_code: coupon.code, discount_eur, discount_kmf });
  }

  // GET — liste des codes promo (admin)
  if (req.method === 'GET') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { data, error } = await supabase
      .from('coupon_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST — créer un code promo (admin)
  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { code, type, value, min_order_eur, max_uses, expires_at } = req.body;
    if (!code || !type || !value) {
      return res.status(400).json({ error: 'code, type, value requis' });
    }

    const { data, error } = await supabase
      .from('coupon_codes')
      .insert({ code: code.toUpperCase(), type, value, min_order_eur, max_uses, expires_at })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    // Log
    const { error: logError } = await supabase.from('admin_logs').insert({
      user_id: auth.user?.id,
      action: 'coupon.created',
      entity_type: 'coupon',
      entity_id: data.id,
      new_value: { code: data.code, type: data.type, value: data.value }
    });
    if (logError) console.error('[admin_logs] insert failed:', logError.message);

    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
