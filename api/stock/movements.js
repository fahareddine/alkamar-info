// api/stock/movements.js
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — historique des mouvements (admin)
  if (req.method === 'GET') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { product_id, limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('stock_movements')
      .select(`
        id, type, quantity, reference_type, reference_id, note, created_at,
        products(id, name, sku),
        user_profiles(id, full_name)
      `)
      .order('created_at', { ascending: false });

    const safeLimit = Math.min(Number(limit), 200);
    query = query.range(Number(offset), Number(offset) + safeLimit - 1);

    if (product_id) query = query.eq('product_id', product_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST — ajustement manuel (admin)
  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { product_id, type, quantity, note } = req.body;
    const qty = Number(quantity);
    if (!product_id || !type || !Number.isInteger(qty) || qty === 0) {
      return res.status(400).json({ error: 'product_id, type et quantity (entier non nul) requis' });
    }
    if (!['in','out','adjustment','return'].includes(type)) {
      return res.status(400).json({ error: 'type invalide : in|out|adjustment|return' });
    }

    // Lire stock actuel pour le log
    const { data: product } = await supabase
      .from('products')
      .select('stock')
      .eq('id', product_id)
      .single();

    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
        product_id,
        type,
        quantity: qty,
        reference_type: 'manual',
        note,
        created_by: auth.user?.id
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Log admin
    const { error: logError } = await supabase.from('admin_logs').insert({
      user_id: auth.user?.id,
      action: 'stock.adjusted',
      entity_type: 'product',
      entity_id: product_id,
      old_value: { stock: product?.stock },
      new_value: { type, quantity: qty, note }
    });
    if (logError) console.error('[admin_logs] insert failed:', logError.message);

    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
