// api/product.js — GET/PUT/DELETE /api/products/:id → /api/product?id=:id
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

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
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'id requis' });

  if (req.method === 'GET') {
    const isUUID = /^[0-9a-f-]{36}$/.test(id);
    let data, error;
    if (isUUID) {
      ({ data, error } = await supabase.from('products').select('*, categories(id, name, slug, parent_id, icon)').eq('id', id).single());
    } else {
      const { data: d1 } = await supabase.from('products').select('*, categories(id, name, slug, parent_id, icon)').eq('legacy_id', id).maybeSingle();
      if (d1) {
        data = d1;
      } else {
        ({ data, error } = await supabase.from('products').select('*, categories(id, name, slug, parent_id, icon)').eq('slug', id).single());
      }
    }
    if (error || !data) return res.status(404).json({ error: 'Produit introuvable' });

    if (req.query._og === '1') {
      const p = data;
      const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
      const base  = `${proto}://${req.headers.host}`;
      const prodUrl = `${base}/produit.html?id=${encodeURIComponent(id)}`;
      const title = _e(p.name + ' — Boutique Info Experts');
      const img   = _e(_ogImg(p.main_image_url) || _ogImg(p.image) || `${base}/favicon.svg`);
      const price = p.price_eur ? `${Number(p.price_eur).toFixed(2).replace('.', ',')} €` : '';
      const hasPromo = p.badge && /promo|%|solde/i.test(p.badge);
      let rawDesc;
      if (hasPromo && price) rawDesc = `🔥 Promo Info Experts : ${p.name} à ${price}`;
      else if (price)        rawDesc = `${p.brand ? p.brand + ' · ' : ''}${p.name} — ${price}`;
      else                   rawDesc = p.subtitle || (p.description || '').slice(0, 160) || 'Boutique informatique aux Comores.';
      const desc = _e(rawDesc.replace(/\s+/g,' ').trim());
      const url  = _e(prodUrl);
      const html = `<!DOCTYPE html><html lang="fr"><head>\n<meta charset="UTF-8"><title>${title}</title>\n<meta name="description" content="${desc}">\n<meta property="og:type" content="product">\n<meta property="og:site_name" content="Boutique Info Experts">\n<meta property="og:title" content="${title}">\n<meta property="og:description" content="${desc}">\n<meta property="og:image" content="${img}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:url" content="${url}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${title}">\n<meta name="twitter:description" content="${desc}">\n<meta name="twitter:image" content="${img}">\n<link rel="canonical" href="${url}">\n<meta http-equiv="refresh" content="0;url=${url}">\n<script>window.location.replace(${JSON.stringify(prodUrl)});</script>\n</head><body></body></html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      res.setHeader('Link', `<${prodUrl}>; rel="canonical"`);
      return res.status(200).send(html);
    }

    return res.status(200).json(data);
  }

  if (req.method === 'PUT') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const ALLOWED = new Set(['name','subtitle','description','brand','category_id','price_eur','price_kmf','price_old','stock','status','image','main_image_url','images','gallery_urls','gallery','badge','badge_class','stock_label','stock_class','features','specs','legacy_id','rating','rating_count','weight_kg','dimensions','meta_title','meta_description','is_featured','sort_order','tags']);
    const update = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => ALLOWED.has(k)));
    const { data, error } = await supabase
      .from('products')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

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
