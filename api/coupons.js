// api/coupons.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

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
