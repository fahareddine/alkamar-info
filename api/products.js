// api/products.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Route fusionnée : /api/stock/movements → /api/products?_route=stock
  if (req.query._route === 'stock') {
    if (req.method === 'GET') {
      const auth = await requireRole(req, 'admin');
      if (auth.error) return res.status(auth.status).json({ error: auth.error });
      const { product_id, limit = '50', offset = '0' } = req.query;
      const safeLimit = Math.min(Number(limit), 200);
      let query = supabase
        .from('stock_movements')
        .select(`id, type, quantity, reference_type, reference_id, note, created_at, products(id, name, sku), user_profiles(id, full_name)`)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + safeLimit - 1);
      if (product_id) query = query.eq('product_id', product_id);
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
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
      const { data: product } = await supabase.from('products').select('stock').eq('id', product_id).single();
      const { data, error } = await supabase
        .from('stock_movements')
        .insert({ product_id, type, quantity: qty, reference_type: 'manual', note, created_by: auth.user?.id })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      const { error: logError } = await supabase.from('admin_logs').insert({
        user_id: auth.user?.id, action: 'stock.adjusted', entity_type: 'product',
        entity_id: product_id, old_value: { stock: product?.stock }, new_value: { type, quantity: qty, note }
      });
      if (logError) console.error('[admin_logs] insert failed:', logError.message);
      return res.status(201).json(data);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // GET — lecture publique avec filtres
  if (req.method === 'GET') {
    const { category, subcategory, status, search, limit = '100', offset = '0' } = req.query;

    let query = supabase
      .from('products')
      .select(`
        id, legacy_id, name, subtitle, slug, description,
        price_eur, price_kmf, price_old, stock, stock_label, status,
        brand, badge, badge_class, rating, rating_count,
        image, gallery, features, specs, created_at,
        categories(id, name, slug, parent_id, icon)
      `)
      .order('name');

    if (status === 'all') {
      // pas de filtre statut
    } else {
      query = query.eq('status', status || 'active');
    }

    if (category) query = query.eq('category_id', category);
    if (subcategory) {
      // Résoudre le slug en category_id
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', subcategory)
        .single();
      if (cat) query = query.eq('category_id', cat.id);
      else return res.status(200).json([]);
    }
    if (search) query = query.ilike('name', `%${search}%`);

    query = query.range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST ?action=import — scraper une URL produit et créer le produit
  if (req.method === 'POST' && req.query.action === 'import') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { url } = req.body || {};
    if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'url valide requise' });

    const { scrapeProduct } = require('./_lib/scraper');
    try {
      const product = await scrapeProduct(url);
      if (!product.name) return res.status(422).json({ error: 'Impossible d\'extraire le nom du produit depuis cette page' });

      // Slug unique
      const { data: existing } = await supabase.from('products').select('id').eq('slug', product.slug).maybeSingle();
      if (existing) product.slug = product.slug + '-' + Date.now().toString(36);

      const { data, error } = await supabase.from('products').insert(product).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    } catch (err) {
      console.error('[import-product]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // POST — créer un produit (admin ou editor)
  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { data, error } = await supabase
      .from('products')
      .insert(req.body)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
