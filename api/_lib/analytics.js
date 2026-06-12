// api/_lib/analytics.js
// Analytics ventes pour le dashboard admin — délégué depuis api/orders.js (_route=analytics)
const { supabase } = require('./supabase');
const { requireRole } = require('./auth');

module.exports = async function analytics(req, res) {
  const auth = await requireRole(req, 'admin', 'commercial');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const since30 = new Date(Date.now() - 30 * 864e5).toISOString();

    const [{ data: orders }, { data: items }, { data: activeProducts }] = await Promise.all([
      supabase.from('orders')
        .select('id, created_at, total_eur, status, payment_status')
        .gte('created_at', since30).limit(2000),
      supabase.from('order_items')
        .select('product_id, product_name, quantity, price_eur, orders!inner(created_at, status)')
        .gte('orders.created_at', since30).neq('orders.status', 'cancelled').limit(5000),
      supabase.from('products')
        .select('id, name, price_eur').eq('status', 'active').gt('price_eur', 0).limit(500),
    ]);

    const valid = (orders || []).filter(o => o.status !== 'cancelled');
    const paid = valid.filter(o => o.payment_status === 'paid');

    // CA par jour (30 jours) — commandes non annulées
    const byDay = {};
    for (let i = 29; i >= 0; i--) {
      byDay[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)] = 0;
    }
    valid.forEach(o => {
      const d = o.created_at.slice(0, 10);
      if (d in byDay) byDay[d] += Number(o.total_eur) || 0;
    });

    // Top produits vendus (depuis order_items)
    const sold = {};
    (items || []).forEach(i => {
      const k = i.product_id || i.product_name;
      if (!sold[k]) sold[k] = { name: i.product_name, qty: 0, revenue: 0, product_id: i.product_id };
      sold[k].qty += i.quantity || 1;
      sold[k].revenue += (Number(i.price_eur) || 0) * (i.quantity || 1);
    });
    const topProducts = Object.values(sold).sort((a, b) => b.qty - a.qty).slice(0, 8);

    // Produits actifs jamais vendus (sur 30 jours)
    const soldIds = new Set(Object.values(sold).map(s => s.product_id).filter(Boolean));
    const neverSold = (activeProducts || []).filter(p => !soldIds.has(p.id));

    const totalCA = valid.reduce((s, o) => s + (Number(o.total_eur) || 0), 0);

    return res.status(200).json({
      period_days: 30,
      revenue_by_day: byDay,
      total_revenue_eur: Math.round(totalCA * 100) / 100,
      orders_count: valid.length,
      paid_count: paid.length,
      paid_rate: valid.length ? Math.round((paid.length / valid.length) * 100) : 0,
      avg_cart_eur: valid.length ? Math.round((totalCA / valid.length) * 100) / 100 : 0,
      top_products: topProducts,
      never_sold_count: neverSold.length,
      never_sold_sample: neverSold.slice(0, 10).map(p => ({ id: p.id, name: p.name, price_eur: p.price_eur })),
    });
  } catch (e) {
    console.error('[analytics]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
