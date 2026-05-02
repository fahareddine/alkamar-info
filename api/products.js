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

  // Route fusionnée : /api/suppliers/offers → /api/products?_route=supplier_offers
  if (req.query._route === 'supplier_offers') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { product_id, offer_id } = req.query;

    if (req.method === 'GET') {
      if (!product_id) return res.status(400).json({ error: 'product_id requis' });
      const { data, error } = await supabase
        .from('product_supplier_offers').select('*')
        .eq('product_id', product_id).order('score', { ascending: false, nullsFirst: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const { data, error } = await supabase
        .from('product_supplier_offers')
        .insert({ ...req.body, updated_at: new Date().toISOString() }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      if (!offer_id) return res.status(400).json({ error: 'offer_id requis' });
      const { data, error } = await supabase
        .from('product_supplier_offers')
        .update({ ...req.body, updated_at: new Date().toISOString() })
        .eq('id', offer_id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (!offer_id) return res.status(400).json({ error: 'offer_id requis' });
      const { error } = await supabase.from('product_supplier_offers').delete().eq('id', offer_id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).end();
    }
    if (req.method === 'PATCH') {
      if (!offer_id || !product_id) return res.status(400).json({ error: 'offer_id et product_id requis' });
      const { data: offer, error: offerErr } = await supabase
        .from('product_supplier_offers').select('*').eq('id', offer_id).single();
      if (offerErr) return res.status(404).json({ error: 'Offre introuvable' });
      const { error: prodErr } = await supabase.from('products').update({
        supplier_url: offer.supplier_url, supplier_name: offer.supplier_name,
        supplier_price: offer.price, supplier_currency: offer.currency || 'EUR',
        supplier_shipping: offer.shipping_price, supplier_delivery: offer.delivery_estimate,
        supplier_availability: offer.availability,
        supplier_last_checked: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', product_id);
      if (prodErr) return res.status(500).json({ error: prodErr.message });
      await supabase.from('product_supplier_offers').update({ is_primary: false }).eq('product_id', product_id);
      await supabase.from('product_supplier_offers').update({ is_primary: true }).eq('id', offer_id);
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Méthode non supportée' });
  }

  // Route fusionnée : /api/suppliers/search → /api/products?_route=supplier_search
  if (req.query._route === 'supplier_search') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

    const SERPAPI_KEY = process.env.SERPAPI_KEY;
    if (!SERPAPI_KEY) {
      return res.status(402).json({
        error: 'SERPAPI_KEY manquante',
        setup: 'Ajoute SERPAPI_KEY dans Vercel env vars (https://serpapi.com — 100 requêtes/mois gratuites)',
      });
    }

    const { name, brand, asin, sku, legacy_id, specs, price_eur } = req.body;
    if (!name) return res.status(400).json({ error: 'name requis' });

    // Extraire le numéro de modèle depuis le nom (ex: "i5-13600K", "MX500", "RX 6600")
    const modelMatch = name.match(/\b([A-Z]{1,4}[-\s]?[\dA-Z]{2,}[-\s]?[\dA-Z]*)\b/g) || [];
    const modelRef = modelMatch.filter(m => m.length >= 3)[0] || '';

    // Extraire des termes clés des specs (capacité, mémoire, taille écran, etc.)
    const specKeywords = [];
    if (specs && typeof specs === 'object') {
      const usefulKeys = ['Capacité','Stockage','Mémoire','RAM','Écran','Fréquence','Format','Socket'];
      usefulKeys.forEach(k => {
        const v = specs[k] || specs[k.toLowerCase()];
        if (v && typeof v === 'string' && v.length < 20) specKeywords.push(v);
      });
    }

    const trustedSources = ['amazon', 'ldlc', 'fnac', 'darty', 'boulanger', 'cdiscount',
                            'rueducommerce', 'materiel.net', 'grosbill', 'cybertek'];

    // Fonction de scoring d'un résultat SerpAPI
    function scoreResult(item, isExactSearch) {
      const priceStr = (item.price || '').replace(/[^\d,\.]/g, '').replace(',', '.');
      const price = parseFloat(priceStr) || null;
      const deliveryText = (item.delivery || '').toLowerCase();
      const shippingFree = /gratuit|free|offert/i.test(deliveryText);
      const shipping = shippingFree ? 0 : null;
      const inStock = !/rupture|indisponible|unavailable/i.test(deliveryText);
      const sourceLower = (item.source || '').toLowerCase();
      const isTrusted = trustedSources.some(s => sourceLower.includes(s));
      const titleLower = (item.title || '').toLowerCase();
      const nameLower  = name.toLowerCase();
      const brandLower = (brand || '').toLowerCase();

      // Confiance : correspondance exacte de référence
      let confidence = 30;
      // +25 si le modèle exact est dans le titre
      if (modelRef && titleLower.includes(modelRef.toLowerCase())) confidence += 35;
      // +15 si la marque est dans le titre
      if (brandLower && titleLower.includes(brandLower)) confidence += 15;
      // +20 selon le ratio de mots du nom présents dans le titre
      const nameWords = nameLower.split(/\s+/).filter(w => w.length > 3);
      const matched = nameWords.filter(w => titleLower.includes(w));
      confidence += Math.round((matched.length / Math.max(nameWords.length, 1)) * 20);
      // +5 si specs key words présents
      const specMatches = specKeywords.filter(k => titleLower.includes(k.toLowerCase()));
      confidence += Math.min(10, specMatches.length * 5);
      confidence = Math.min(100, confidence);

      // Score global
      let score = 0;
      score += (confidence / 100) * 50;   // Correspondance : 50%
      if (price && price > 0) score += 20; // Prix présent : 20%
      if (inStock) score += 15;            // En stock : 15%
      if (isTrusted) score += 10;          // Vendeur fiable : 10%
      if (isExactSearch) score += 5;       // Résultat de la recherche exacte : bonus 5%
      score = Math.min(100, Math.round(score));

      return {
        supplier_name:     item.source || 'Inconnu',
        supplier_url:      item.link || item.product_link || '',
        title:             item.title || '',
        price, currency: 'EUR',
        shipping_price:    shipping,
        delivery_estimate: item.delivery || null,
        availability:      inStock ? 'in_stock' : 'unknown',
        score, confidence,
        source: 'serpapi', country: 'FR',
      };
    }

    try {
      // ── Requête 1 : EXACTE — référence stricte (modèle + marque)
      const exactTerms = [brand, modelRef || name].filter(Boolean).join(' ').trim();
      const exactUrl = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(exactTerms)}&gl=fr&hl=fr&num=8&api_key=${SERPAPI_KEY}`;
      const [resp1, resp2] = await Promise.all([
        fetch(exactUrl).then(r => r.ok ? r.json() : { shopping_results: [] }),
        // ── Requête 2 : LARGE — nom complet + specs clés
        (exactTerms !== [brand, name].join(' ').trim())
          ? fetch(`https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent([brand, name, specKeywords[0] || ''].join(' ').trim())}&gl=fr&hl=fr&num=6&api_key=${SERPAPI_KEY}`).then(r => r.ok ? r.json() : { shopping_results: [] })
          : Promise.resolve({ shopping_results: [] }),
      ]);

      // Combiner et dédupliquer par URL
      const exactResults = (resp1.shopping_results || []).map(i => scoreResult(i, true));
      const broadResults = (resp2.shopping_results || []).map(i => scoreResult(i, false));

      const seen = new Set();
      const all = [...exactResults, ...broadResults].filter(r => {
        if (!r.supplier_url || seen.has(r.supplier_url)) return false;
        seen.add(r.supplier_url);
        return true;
      });

      // Trier : d'abord par confiance (≥80 = correspondance exacte), puis par score
      all.sort((a, b) => {
        const aExact = a.confidence >= 80 ? 1 : 0;
        const bExact = b.confidence >= 80 ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact; // Exacts en premier
        return b.score - a.score;
      });

      return res.status(200).json({
        offers: all.slice(0, 10),
        query: exactTerms,
        exact_count: all.filter(r => r.confidence >= 80).length,
      });
    } catch (e) {
      return res.status(500).json({ error: 'Recherche échouée : ' + e.message });
    }
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
        image, main_image_url, gallery, gallery_urls, features, specs, created_at,
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

  // POST ?action=scrape — scraper une URL sans créer de produit (pré-remplissage fiche)
  if (req.method === 'POST' && req.query.action === 'scrape') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { url } = req.body || {};
    if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'url valide requise' });
    const { scrapeProduct } = require('./_lib/scraper');
    try {
      const product = await scrapeProduct(url);
      return res.status(200).json(product);
    } catch (err) {
      console.error('[scrape]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // POST ?action=import — scraper une URL produit et créer le produit
  if (req.method === 'POST' && req.query.action === 'import') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { url, category_id } = req.body || {};
    if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'url valide requise' });

    const { scrapeProduct } = require('./_lib/scraper');
    try {
      const product = await scrapeProduct(url);
      if (!product.name) return res.status(422).json({ error: 'Impossible d\'extraire le nom du produit depuis cette page' });
      if (!product.price_eur) product.price_eur = 0;
      if (!product.price_kmf) product.price_kmf = 0;
      if (category_id) product.category_id = category_id;

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
