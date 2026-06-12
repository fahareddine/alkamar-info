// api/_lib/counts.js
// Compteurs temps réel pour les badges du menu admin — délégué depuis api/orders.js
// (_route=counts). Léger : 4 counts head-only en parallèle.
const { supabase } = require('./supabase');
const { requireRole } = require('./auth');

module.exports = async function counts(req, res) {
  const auth = await requireRole(req, 'admin', 'commercial');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const [ordersPending, reviewsPending, unpaid, stockOut] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('product_reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('orders').select('*', { count: 'exact', head: true })
        .eq('payment_status', 'unpaid').eq('payment_method', 'stripe')
        .neq('status', 'cancelled').not('customer_email', 'is', null),
      supabase.from('products').select('*', { count: 'exact', head: true })
        .eq('status', 'active').lte('stock', 0),
    ]);

    res.setHeader('Cache-Control', 'private, max-age=30');
    return res.status(200).json({
      orders_pending: ordersPending.count || 0,
      reviews_pending: reviewsPending.count || 0,
      unpaid: unpaid.count || 0,
      stock_out: stockOut.count || 0,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
