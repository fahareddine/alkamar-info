const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  // Route fusionnée : /api/logs → /api/stats?_route=logs
  if (req.query._route === 'logs') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { entity_type, entity_id, action, limit = '100', offset = '0' } = req.query;
    const safeLimit = Math.min(Number(limit), 200);
    let query = supabase
      .from('admin_logs')
      .select(`id, action, entity_type, entity_id, old_value, new_value, ip_address, created_at, user_profiles(id, full_name)`)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + safeLimit - 1);
    if (entity_type) query = query.eq('entity_type', entity_type);
    if (entity_id) query = query.eq('entity_id', entity_id);
    if (action) query = query.eq('action', action);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [ordersMonth, ordersTotal, stockAlert, recentOrders] = await Promise.all([
    supabase.from('orders').select('total_eur, total_kmf').gte('created_at', startOfMonth).neq('status', 'cancelled'),
    supabase.from('orders').select('id, status', { count: 'exact' }),
    supabase.from('products').select('id, name, stock').lt('stock', 3).eq('status', 'active').order('stock'),
    supabase.from('orders').select('id, status, total_eur, total_kmf, created_at, customers(name)').order('created_at', { ascending: false }).limit(10),
  ]);

  const ca_eur = (ordersMonth.data || []).reduce((s, o) => s + Number(o.total_eur), 0);
  const ca_kmf = (ordersMonth.data || []).reduce((s, o) => s + Number(o.total_kmf), 0);
  const pending = (ordersTotal.data || []).filter(o => o.status === 'pending').length;

  return res.status(200).json({
    ca: { eur: ca_eur, kmf: ca_kmf },
    orders: { total: ordersTotal.count || 0, pending },
    stock_alerts: stockAlert.data || [],
    recent_orders: recentOrders.data || [],
  });
};
