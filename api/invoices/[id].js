// api/invoices/[id].js
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin', 'commercial');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { id } = req.query;

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      orders(
        id, status, payment_method, payment_status, notes, coupon_code, discount_eur,
        order_items(quantity, unit_price_eur, unit_price_kmf, product_snapshot)
      ),
      customers(id, name, email, phone, address, city, island)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return res.status(404).json({ error: 'Facture introuvable' });
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json(data);
};
