const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { id } = req.query;

  if (req.method === 'GET') {
    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { data, error } = await supabase
      .from('orders')
      .select('*, customers(*), order_items(*, products(name, image, price_eur))')
      .eq('id', id)
      .single();
    if (error) return res.status(404).json({ error: 'Commande introuvable' });
    return res.status(200).json(data);
  }

  if (req.method === 'PUT') {
    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    // Fetch current status before update (needed for previousStatus)
    const { data: existing, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', id)
      .single();
    if (fetchError) {
      if (fetchError.code === 'PGRST116') return res.status(404).json({ error: 'Commande introuvable' });
      return res.status(500).json({ error: fetchError.message });
    }
    const previousStatus = existing.status;

    const { data, error } = await supabase
      .from('orders')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, customer_id, total_eur, total_kmf, discount_eur, discount_kmf')
      .single();
    if (error) return res.status(500).json({ error: error.message });

    // Auto-actions on confirmation
    if (req.body.status === 'confirmed' && previousStatus !== 'confirmed') {
      // Décrémenter le stock pour chaque article
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', id);
      if (itemsError) console.error('[order_items] fetch failed:', itemsError.message);

      for (const item of (items || [])) {
        const { error: smError } = await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          type: 'out',
          quantity: item.quantity,
          reference_type: 'order',
          reference_id: id,
          note: `Commande confirmée #${id.slice(0, 8)}`
        });
        if (smError) console.error('[stock_movements] insert failed for product', item.product_id, smError.message);
      }

      // Créer la facture automatiquement
      if (data && data.customer_id) {
        const { error: invError } = await supabase.from('invoices').insert({
          order_id: id,
          customer_id: data.customer_id,
          total_eur: data.total_eur,
          total_kmf: data.total_kmf,
          discount_eur: data.discount_eur || 0,
          discount_kmf: data.discount_kmf || 0
        });
        if (invError) console.error('[invoices] auto-create failed:', invError.message);
      } else {
        console.error('[invoices] skipped: missing customer_id for order', id);
      }

      // Log admin
      const { error: logError } = await supabase.from('admin_logs').insert({
        user_id: auth.user?.id,
        action: 'order.status_changed',
        entity_type: 'order',
        entity_id: id,
        old_value: { status: previousStatus },
        new_value: { status: 'confirmed' }
      });
      if (logError) console.error('[admin_logs] insert failed:', logError.message);
    }

    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
