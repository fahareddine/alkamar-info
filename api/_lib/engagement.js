// api/_lib/engagement.js
// Routes publiques engagement client : avis produits + alertes retour en stock.
// Délégué depuis api/products.js (_route=reviews | _route=stock_alert)
const { supabase } = require('./supabase');

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Recalcule la note moyenne d'un produit depuis ses avis approuvés
async function recomputeRating(productId) {
  const { data } = await supabase.from('product_reviews')
    .select('rating').eq('product_id', productId).eq('status', 'approved');
  const count = (data || []).length;
  const avg = count ? Math.round((data.reduce((s, r) => s + r.rating, 0) / count)) : 0;
  // Ne touche au rating produit que s'il y a au moins un avis approuvé
  if (count > 0) {
    await supabase.from('products').update({ rating: avg, rating_count: count }).eq('id', productId);
  }
}

// ── Avis produits ───────────────────────────────────────────────────────────
async function handleReviews(req, res) {
  // ── Admin : liste tous les avis / modère / supprime ──
  if (req.query.admin === '1') {
    const { requireRole } = require('./auth');
    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    if (req.method === 'GET') {
      const status = req.query.status || null;
      let q = supabase.from('product_reviews')
        .select('id, product_id, author_name, email, rating, comment, status, created_at, products(name, slug, legacy_id)')
        .order('created_at', { ascending: false }).limit(200);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
      const { id, status } = req.body || {};
      if (!id || !['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'id et status (approved|rejected|pending) requis' });
      }
      const { data, error } = await supabase.from('product_reviews')
        .update({ status }).eq('id', id).select('product_id').single();
      if (error) return res.status(500).json({ error: error.message });
      await recomputeRating(data.product_id);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { data, error } = await supabase.from('product_reviews')
        .delete().eq('id', req.query.id).select('product_id').maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (data) await recomputeRating(data.product_id);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  // GET — avis approuvés d'un produit + stats
  if (req.method === 'GET') {
    const { product_id } = req.query;
    if (!product_id || !UUID_RE.test(product_id)) {
      return res.status(400).json({ error: 'product_id (UUID) requis' });
    }
    const { data, error } = await supabase
      .from('product_reviews')
      .select('id, author_name, rating, comment, created_at')
      .eq('product_id', product_id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });

    const count = data.length;
    const avg = count ? Math.round((data.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ reviews: data, count, average: avg });
  }

  // POST — soumettre un avis (modération : status pending)
  if (req.method === 'POST') {
    const { product_id, author_name, email, rating, comment, website } = req.body || {};

    // Honeypot anti-bot
    if (website) return res.status(400).json({ error: 'Requête invalide' });

    if (!product_id || !UUID_RE.test(product_id)) {
      return res.status(400).json({ error: 'product_id invalide' });
    }
    const name = String(author_name || '').trim().slice(0, 60);
    if (name.length < 2) return res.status(400).json({ error: 'Nom requis (2 caractères minimum)' });
    const note = parseInt(rating, 10);
    if (!(note >= 1 && note <= 5)) return res.status(400).json({ error: 'Note entre 1 et 5 requise' });
    const text = String(comment || '').trim().slice(0, 2000);
    const mail = String(email || '').trim().slice(0, 254);
    if (mail && !EMAIL_RE.test(mail)) return res.status(400).json({ error: 'Email invalide' });

    // Produit doit exister et être actif
    const { data: prod } = await supabase.from('products')
      .select('id').eq('id', product_id).eq('status', 'active').maybeSingle();
    if (!prod) return res.status(404).json({ error: 'Produit introuvable' });

    // Anti-spam léger : max 3 avis en attente par produit+email
    if (mail) {
      const { count } = await supabase.from('product_reviews')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', product_id).eq('email', mail);
      if (count >= 3) return res.status(429).json({ error: 'Vous avez déjà soumis un avis pour ce produit' });
    }

    const { error } = await supabase.from('product_reviews').insert({
      product_id, author_name: name, email: mail || null, rating: note, comment: text || null,
    });
    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({ ok: true, message: 'Merci ! Votre avis sera publié après modération.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ── Alertes retour en stock ─────────────────────────────────────────────────
async function handleStockAlert(req, res) {
  // Admin : liste des alertes en attente, groupées par produit
  if (req.query.admin === '1' && req.method === 'GET') {
    const { requireRole } = require('./auth');
    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { data, error } = await supabase.from('stock_alerts')
      .select('id, product_id, email, notified_at, created_at, products(name, slug, legacy_id, stock_label)')
      .order('created_at', { ascending: false }).limit(300);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { product_id, email, website } = req.body || {};
  if (website) return res.status(400).json({ error: 'Requête invalide' });

  if (!product_id || !UUID_RE.test(product_id)) {
    return res.status(400).json({ error: 'product_id invalide' });
  }
  const mail = String(email || '').trim().toLowerCase().slice(0, 254);
  if (!EMAIL_RE.test(mail)) return res.status(400).json({ error: 'Email valide requis' });

  const { data: prod } = await supabase.from('products')
    .select('id').eq('id', product_id).maybeSingle();
  if (!prod) return res.status(404).json({ error: 'Produit introuvable' });

  const { error } = await supabase.from('stock_alerts')
    .upsert({ product_id, email: mail }, { onConflict: 'product_id,email', ignoreDuplicates: true });
  if (error) return res.status(500).json({ error: error.message });

  return res.status(201).json({ ok: true, message: 'C\'est noté ! Nous vous préviendrons dès le retour en stock.' });
}

module.exports = async function engagement(req, res) {
  if (req.query._route === 'reviews')     return handleReviews(req, res);
  if (req.query._route === 'stock_alert') return handleStockAlert(req, res);
  return res.status(404).json({ error: 'Route inconnue' });
};
