'use strict';
// ── API Produits Digitaux — Boutique Info Experts ─────────────────────────────
// Routes (via vercel.json rewrites + query param _route) :
//   GET  /api/digital                  → liste produits digitaux (public)
//   GET  /api/digital?id=slug          → produit unique (public)
//   GET  /api/digital?_route=licenses  → licences par email (auth)
//   POST /api/digital?_route=licenses  → créer licence (interne/webhook)
//   POST /api/digital?_route=download  → URL signée téléchargement (auth)
//   GET  /api/digital?_route=serve     → servir fichier signé
//   GET  /api/digital?_route=subscriptions → abonnements par email (auth)
// Admin (service_role uniquement) :
//   POST /api/digital?_route=create    → créer produit digital
//   PUT  /api/digital?_route=update    → modifier produit digital
//   DELETE /api/digital?_route=delete  → supprimer produit digital

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// ─── Config ───────────────────────────────────────────────────────────────────
const DOWNLOAD_SECRET = process.env.DIGITAL_DOWNLOAD_SECRET || '';
const DOWNLOAD_TTL    = parseInt(process.env.DIGITAL_DOWNLOAD_TTL_SECONDS || '900', 10);
const CORS_HEADERS    = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.status(status).json(data);
}

function err(res, status, msg) {
  return json(res, status, { error: msg });
}

function esc(s) {
  return String(s || '').replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));
}

// Génère une clé de licence au format XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
// Utilise crypto.randomBytes → non prédictible, cryptographiquement sûr
function generateLicenseKey() {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1 (ambigus)
  const buf   = crypto.randomBytes(25);
  let   key   = '';
  for (let i = 0; i < 25; i++) {
    key += CHARS[buf[i] % CHARS.length];
    if (i < 24 && (i + 1) % 5 === 0) key += '-';
  }
  return key; // ex: ABCDE-FGH2J-K3MNP-QRSTU-VWX4Y
}

// Signe une URL de téléchargement (HMAC-SHA256, TTL configurable)
function signDownloadUrl(productId, email, baseUrl) {
  if (!DOWNLOAD_SECRET || DOWNLOAD_SECRET === 'changeme_generate_with_crypto_randomBytes_32') {
    throw new Error('DIGITAL_DOWNLOAD_SECRET non configuré');
  }
  const expires  = Math.floor(Date.now() / 1000) + DOWNLOAD_TTL;
  const urlId    = crypto.randomBytes(8).toString('hex');
  const payload  = `${productId}:${email}:${expires}:${urlId}`;
  const sig      = crypto.createHmac('sha256', DOWNLOAD_SECRET).update(payload).digest('hex');
  const url      = `${baseUrl}/api/digital/serve?p=${productId}&e=${encodeURIComponent(email)}&exp=${expires}&uid=${urlId}&sig=${sig}`;
  return { url, expires, urlId };
}

// Vérifie la signature d'une URL de téléchargement
function verifyDownloadSig(productId, email, expires, urlId, sig) {
  const now     = Math.floor(Date.now() / 1000);
  if (now > parseInt(expires, 10)) return false;
  const payload = `${productId}:${email}:${expires}:${urlId}`;
  const expected = crypto.createHmac('sha256', DOWNLOAD_SECRET).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
}

// ─── Gestionnaire principal ────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  const route = req.query._route || '';
  const sb    = supabaseAdmin();

  try {
    // ── Route : liste / produit unique (public) ──────────────────────────────
    if (!route && req.method === 'GET') {
      const { id, tab, limit = '50', offset = '0' } = req.query;

      // Produit unique par slug
      if (id) {
        const { data, error } = await sb
          .from('products')
          .select('*')
          .eq('is_digital', true)
          .eq('slug', id)
          .eq('status', 'active')
          .single();
        if (error || !data) return err(res, 404, 'Produit digital introuvable');
        return json(res, 200, { product: data });
      }

      // Liste avec filtre par catégorie
      let q = sb
        .from('products')
        .select('id,name,subtitle,slug,price_eur,price_kmf,price_old,badge,badge_class,rating,rating_count,image,gallery,features,specs,is_digital,product_type,billing_period,max_devices,file_version,compatibility,digital_category')
        .eq('is_digital', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10) - 1);

      if (tab && tab !== 'tous') q = q.eq('digital_category', tab);

      const { data, error, count } = await q;
      if (error) throw error;
      return json(res, 200, { products: data || [], total: count });
    }

    // ── Route : licences ─────────────────────────────────────────────────────
    if (route === 'licenses') {
      // GET — licences d'un email
      if (req.method === 'GET') {
        const { email } = req.query;
        if (!email) return err(res, 400, 'email requis');
        const { data, error } = await sb
          .from('digital_licenses')
          .select('*, products(id,name,slug,image,file_version)')
          .eq('customer_email', email.toLowerCase())
          .order('created_at', { ascending: false });
        if (error) throw error;
        return json(res, 200, { licenses: data || [] });
      }

      // POST — créer une licence (appelé par webhook ou admin)
      if (req.method === 'POST') {
        const { order_id, product_id, customer_email, max_devices, expires_at } = req.body || {};
        if (!product_id || !customer_email) return err(res, 400, 'product_id et customer_email requis');

        const licenseKey = generateLicenseKey();
        const { data, error } = await sb
          .from('digital_licenses')
          .insert({
            order_id:       order_id || null,
            product_id,
            customer_email: customer_email.toLowerCase(),
            license_key:    licenseKey,
            max_devices:    max_devices || 1,
            expires_at:     expires_at || null,
            status:         'active',
          })
          .select()
          .single();
        if (error) throw error;
        return json(res, 201, { license: data });
      }
    }

    // ── Route : URL de téléchargement signée ─────────────────────────────────
    if (route === 'download' && req.method === 'POST') {
      const { product_id, email, license_key } = req.body || {};
      if (!product_id || !email || !license_key) {
        return err(res, 400, 'product_id, email et license_key requis');
      }

      // Vérifie que la licence est valide pour cet email + produit
      const { data: lic, error: licErr } = await sb
        .from('digital_licenses')
        .select('id,status,expires_at,product_id')
        .eq('license_key', license_key)
        .eq('customer_email', email.toLowerCase())
        .eq('product_id', product_id)
        .single();

      if (licErr || !lic) return err(res, 403, 'Licence invalide ou non trouvée');
      if (lic.status !== 'active') return err(res, 403, `Licence ${lic.status}`);
      if (lic.expires_at && new Date(lic.expires_at) < new Date()) {
        return err(res, 403, 'Licence expirée');
      }

      // Récupère le produit pour obtenir le file_path
      const { data: prod } = await sb
        .from('products')
        .select('file_path,file_version,name')
        .eq('id', product_id)
        .single();
      if (!prod || !prod.file_path) return err(res, 404, 'Fichier non disponible');

      // Génère l'URL signée
      const proto   = req.headers['x-forwarded-proto'] || 'https';
      const host    = req.headers['x-forwarded-host'] || req.headers.host;
      const baseUrl = `${proto}://${host}`;
      const signed  = signDownloadUrl(product_id, email, baseUrl);

      // Log le téléchargement
      await sb.from('digital_downloads').insert({
        license_id:    lic.id,
        customer_email: email.toLowerCase(),
        product_id,
        file_version:  prod.file_version,
        ip_address:    req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        user_agent:    req.headers['user-agent'],
        signed_url_id: signed.urlId,
      });

      return json(res, 200, {
        url:     signed.url,
        expires: signed.expires,
        filename: prod.name,
      });
    }

    // ── Route : servir le fichier téléchargeable (URL signée) ────────────────
    if (route === 'serve' && req.method === 'GET') {
      const { p: productId, e: email, exp, uid, sig } = req.query;
      if (!productId || !email || !exp || !uid || !sig) {
        return err(res, 400, 'Paramètres manquants');
      }

      // Vérifie la signature et la date d'expiration
      let valid = false;
      try {
        valid = verifyDownloadSig(productId, email, exp, uid, sig);
      } catch (e) {
        return err(res, 500, 'Configuration serveur incorrecte');
      }
      if (!valid) return err(res, 403, 'URL invalide ou expirée');

      // Récupère le fichier depuis Supabase Storage
      const { data: prod } = await sb
        .from('products')
        .select('file_path,name')
        .eq('id', productId)
        .single();
      if (!prod?.file_path) return err(res, 404, 'Fichier introuvable');

      // Génère une URL signée Supabase Storage (TTL 60s — suffisant pour le redirect)
      const { data: storageData, error: storageErr } = await sb.storage
        .from('digital-files')
        .createSignedUrl(prod.file_path, 60);
      if (storageErr || !storageData?.signedUrl) {
        return err(res, 500, 'Impossible de générer l\'URL de stockage');
      }

      res.setHeader('Location', storageData.signedUrl);
      return res.status(302).end();
    }

    // ── Route : abonnements ──────────────────────────────────────────────────
    if (route === 'subscriptions' && req.method === 'GET') {
      const { email } = req.query;
      if (!email) return err(res, 400, 'email requis');
      const { data, error } = await sb
        .from('digital_subscriptions')
        .select('*, products(id,name,slug,image,billing_period,price_eur)')
        .eq('customer_email', email.toLowerCase())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return json(res, 200, { subscriptions: data || [] });
    }

    // ── Admin : CRUD produits digitaux ────────────────────────────────────────
    if (route === 'create' && req.method === 'POST') {
      const p = req.body || {};
      if (!p.name || !p.slug || !p.price_eur) return err(res, 400, 'name, slug et price_eur requis');
      const { data, error } = await sb.from('products').insert({
        ...p, is_digital: true,
        price_kmf: p.price_kmf || Math.round((p.price_eur || 0) * 491),
        status:    p.status || 'active',
      }).select().single();
      if (error) throw error;
      return json(res, 201, { product: data });
    }

    if (route === 'update' && req.method === 'PUT') {
      const { id } = req.query;
      if (!id) return err(res, 400, 'id requis');
      const { data, error } = await sb.from('products').update(req.body).eq('id', id).select().single();
      if (error) throw error;
      return json(res, 200, { product: data });
    }

    if (route === 'delete' && req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return err(res, 400, 'id requis');
      await sb.from('products').update({ status: 'archived' }).eq('id', id);
      return json(res, 200, { ok: true });
    }

    return err(res, 404, 'Route introuvable');

  } catch (e) {
    console.error('[digital] Erreur:', e.message);
    return err(res, 500, 'Erreur serveur');
  }
};
