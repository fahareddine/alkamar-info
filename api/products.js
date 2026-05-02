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

  // ─── Route : /api/pricing/settings ──────────────────────────────────────────
  if (req.query._route === 'pricing_settings') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('pricing_settings').select('*').limit(1).single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    if (req.method === 'PUT') {
      const { data: existing } = await supabase.from('pricing_settings').select('id').limit(1).single();
      if (!existing) return res.status(404).json({ error: 'pricing_settings non trouvé' });
      const allowed = ['eur_to_kmf_rate','transport_per_kg_eur','fixed_fee_per_product_eur',
        'default_customs_rate','default_local_tax_rate','default_margin_rate','minimum_margin_rate','safety_rate'];
      const updates = { updated_at: new Date().toISOString() };
      allowed.forEach(k => { if (req.body[k] != null) updates[k] = Number(req.body[k]); });
      const { data, error } = await supabase.from('pricing_settings').update(updates).eq('id', existing.id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── Route : /api/pricing/calculate ─────────────────────────────────────────
  if (req.query._route === 'pricing_calculate') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });
    const { calculateComorosPrice } = require('./_lib/pricing');
    const { product_id, ...input } = req.body || {};
    if (!product_id) return res.status(400).json({ error: 'product_id requis' });
    const { data: settings, error: sErr } = await supabase.from('pricing_settings').select('*').limit(1).single();
    if (sErr) return res.status(500).json({ error: 'pricing_settings manquants' });
    const result = calculateComorosPrice(input, settings);
    const hasWeightIssue = result.warnings.includes('weight_missing') || result.warnings.includes('purchase_price_missing');
    const pricingRow = {
      product_id,
      purchase_price:             Number(input.purchasePrice) || null,
      purchase_currency:          input.purchaseCurrency || 'EUR',
      supplier_shipping_price:    Number(input.supplierShipping) || 0,
      weight_kg:                  Number(input.weightKg) || null,
      customs_rate:               input.customsRate != null ? Number(input.customsRate) : null,
      local_tax_rate:             input.localTaxRate != null ? Number(input.localTaxRate) : null,
      target_margin_rate:         input.targetMarginRate != null ? Number(input.targetMarginRate) : null,
      risk_rate:                  Number(input.riskRate) || 0.05,
      local_competitor_price_kmf: Number(input.localCompetitorPriceKmf) || null,
      total_landed_cost_eur:      result.totalLandedCost,
      recommended_price_eur:      result.recommendedEur,
      recommended_price_kmf:      result.recommendedKmf,
      margin_amount_eur:          result.marginAmount,
      margin_rate:                result.marginRate,
      price_status:               hasWeightIssue ? 'to_verify' : 'calculated',
      competitiveness_status:     result.competitivenessStatus,
      calculation_details:        result,
      pricing_notes:              input.pricingNotes || null,
      calculated_at:              new Date().toISOString(),
      updated_at:                 new Date().toISOString(),
    };
    const { error: uErr } = await supabase.from('product_pricing').upsert(pricingRow, { onConflict: 'product_id' });
    if (uErr) return res.status(500).json({ error: uErr.message });
    return res.status(200).json({ result, warnings: result.warnings });
  }

  // ─── Route : /api/pricing/apply ─────────────────────────────────────────────
  if (req.query._route === 'pricing_apply') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });
    const { product_id, use_manual, manual_price_eur, manual_price_kmf, pricing_notes } = req.body || {};
    if (!product_id) return res.status(400).json({ error: 'product_id requis' });
    const { data: product } = await supabase.from('products').select('price_eur, price_kmf').eq('id', product_id).single();
    const { data: pp } = await supabase.from('product_pricing').select('*').eq('product_id', product_id).single();
    if (!pp) return res.status(404).json({ error: 'Prix calculé introuvable — lancez d\'abord le calcul' });
    const isManual = !!use_manual;
    const newEur   = isManual ? Number(manual_price_eur) : pp.recommended_price_eur;
    const newKmf   = isManual ? Number(manual_price_kmf) : pp.recommended_price_kmf;
    if (!newEur || newEur <= 0) return res.status(400).json({ error: 'Prix invalide (EUR requis > 0)' });
    const finalKmf = newKmf || Math.round(newEur * (settings?.eur_to_kmf_rate || 491));
    await supabase.from('product_price_history').insert({
      product_id, old_price_eur: product?.price_eur, old_price_kmf: product?.price_kmf,
      new_price_eur: newEur, new_price_kmf: finalKmf, recommended_eur: pp.recommended_price_eur,
      source: isManual ? 'manual_update' : 'recommended_apply_single', pricing_notes: pricing_notes || null,
    });
    const { error: pErr } = await supabase.from('products').update({ price_eur: newEur, price_kmf: finalKmf, updated_at: new Date().toISOString() }).eq('id', product_id);
    if (pErr) return res.status(500).json({ error: pErr.message });
    await supabase.from('product_pricing').update({
      final_price_eur: newEur, final_price_kmf: finalKmf, is_manual_price: isManual,
      price_status: 'validated', validated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('product_id', product_id);
    return res.status(200).json({ success: true, newPriceEur: newEur, newPriceKmf: finalKmf });
  }

  // ─── Route : /api/pricing/validate-all ──────────────────────────────────────
  if (req.query._route === 'pricing_validate_all') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });
    if (!req.body?.confirmed) return res.status(400).json({ error: 'confirmed:true requis (protection anti-abus)' });
    const { data: eligibles } = await supabase.from('product_pricing')
      .select('product_id,final_price_eur,final_price_kmf,recommended_price_eur,recommended_price_kmf,price_status,is_manual_price,margin_rate')
      .in('price_status', ['calculated','validated','manual']).gt('recommended_price_eur', 0);
    if (!eligibles?.length) return res.status(200).json({ updated: 0, ignored: 0, message: 'Aucun produit éligible' });
    let updated = 0, ignored = 0;
    for (const pp of eligibles) {
      if (pp.margin_rate != null && pp.margin_rate < 0) { ignored++; continue; }
      const newEur = pp.is_manual_price ? pp.final_price_eur : pp.recommended_price_eur;
      const newKmf = pp.is_manual_price ? pp.final_price_kmf : pp.recommended_price_kmf;
      if (!newEur || newEur <= 0) { ignored++; continue; }
      const { data: prod } = await supabase.from('products').select('price_eur,price_kmf').eq('id', pp.product_id).single();
      await supabase.from('product_price_history').insert({
        product_id: pp.product_id, old_price_eur: prod?.price_eur, old_price_kmf: prod?.price_kmf,
        new_price_eur: newEur, new_price_kmf: newKmf, recommended_eur: pp.recommended_price_eur, source: 'global_validation',
      });
      await supabase.from('products').update({ price_eur: newEur, price_kmf: newKmf, updated_at: new Date().toISOString() }).eq('id', pp.product_id);
      await supabase.from('product_pricing').update({ final_price_eur: newEur, final_price_kmf: newKmf, price_status: 'validated', validated_at: new Date().toISOString() }).eq('product_id', pp.product_id);
      updated++;
    }
    return res.status(200).json({ updated, ignored, total: eligibles.length });
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
