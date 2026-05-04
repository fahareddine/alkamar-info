// api/products/[id].js
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

/* ── OG helpers ─────────────────────────────────────────────────────────── */
const _BANNED_IMG = ['ldlc.com','/ldlc','ldlc-media','cdiscount.com','fnac.com','darty.com','boulanger.com'];
function _ogImg(url) {
  if (!url || !url.startsWith('http')) return null;
  if (_BANNED_IMG.some(d => url.toLowerCase().includes(d))) return null;
  if (url.includes('m.media-amazon.com/images') && url.match(/\._[A-Z]{2}[A-Z0-9_,]+_\./)) {
    const [b, q] = url.split('?');
    const s = b.replace(/\._[^.]+_(?=\.(jpg|jpeg|png))/gi,'').replace(/\.(jpg|jpeg|png)$/i,'._SL1200_.$1');
    return q ? `${s}?${q}` : s;
  }
  return url;
}
function _e(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  // GET — lecture publique par UUID ou legacy_id
  if (req.method === 'GET') {
    const isUUID = /^[0-9a-f-]{36}$/.test(id);
    let query;
    if (isUUID) {
      query = supabase.from('products').select('*, categories(id, name, slug, parent_id, icon)').eq('id', id).single();
    } else {
      query = supabase.from('products').select('*, categories(id, name, slug, parent_id, icon)').eq('legacy_id', id).single();
    }
    const { data, error } = await query;
    if (error) return res.status(404).json({ error: 'Produit introuvable' });

    // ?_og=1 — renvoie HTML avec métas Open Graph pour les crawlers sociaux
    if (req.query._og === '1') {
      const p = data;
      const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
      const base  = `${proto}://${req.headers.host}`;
      const prodUrl = `${base}/produit.html?id=${encodeURIComponent(id)}`;

      const title = _e(p.name + ' — Alkamar Info');
      const img   = _e(_ogImg(p.main_image_url) || _ogImg(p.image) || `${base}/favicon.svg`);
      const price = p.price_eur ? `${Number(p.price_eur).toFixed(2).replace('.', ',')} €` : '';
      const hasPromo = p.badge && /promo|%|solde/i.test(p.badge);
      let rawDesc;
      if (hasPromo && price) rawDesc = `🔥 Promo Alkamar : ${p.name} à ${price}`;
      else if (price)        rawDesc = `${p.brand ? p.brand + ' · ' : ''}${p.name} — ${price}`;
      else                   rawDesc = p.subtitle || (p.description || '').slice(0, 160) || 'Boutique informatique aux Comores.';
      const desc = _e(rawDesc.replace(/\s+/g,' ').trim());
      const url  = _e(prodUrl);

      const html = `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Alkamar Info">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${img}">
<link rel="canonical" href="${url}">
<meta http-equiv="refresh" content="0;url=${url}">
<script>window.location.replace(${JSON.stringify(prodUrl)});</script>
</head><body></body></html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      return res.status(200).send(html);
    }

    return res.status(200).json(data);
  }

  // PUT — modifier (admin ou editor)
  if (req.method === 'PUT') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { data, error } = await supabase
      .from('products')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // DELETE — archiver (admin uniquement)
  if (req.method === 'DELETE') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { error } = await supabase
      .from('products')
      .update({ status: 'archived' })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ archived: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
