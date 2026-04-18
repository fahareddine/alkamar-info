// scripts/fetch_gallery3.js — Galerie multi-sources (LDLC + Amazon search)
// Usage: node scripts/fetch_gallery3.js
// Exécuter en LOCAL (pas depuis Vercel) — l'IP locale n'est pas bloquée

const https = require('https');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const SUBCATEGORIES = ['portables', 'bureau', 'gaming', 'toutunun', 'reconditiones', 'minipc'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function request(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9',
      'Accept-Encoding': 'identity',
      'Cache-Control': 'no-cache',
      ...opts.headers,
    };
    const req = mod.get(url, { headers }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 308) {
        const loc = res.headers.location;
        if (!loc) return reject(new Error('redirect sans location'));
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        return request(next, opts).then(resolve).catch(reject);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, url }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── Source 1 : Amazon.fr page produit (ASIN connu) ─────────────────────────

function extractAmazonImages(html) {
  const seen = new Set();
  const out = [];

  const add = (raw) => {
    if (!raw || !raw.includes('m.media-amazon.com')) return;
    const clean = raw
      .replace(/\._[A-Z]{2}[A-Z0-9,_]*_\./g, '.')
      .replace(/\._SX\d+_\./g, '.')
      .replace(/\._SY\d+_\./g, '.')
      .replace(/\._CR\d+,\d+,\d+,\d+_\./g, '.');
    if (!clean.endsWith('.jpg') && !clean.endsWith('.png')) return;
    if (seen.has(clean)) return;
    seen.add(clean);
    out.push(clean);
  };

  for (const m of html.matchAll(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon[^"]+)"/g)) add(m[1]);
  for (const m of html.matchAll(/"large"\s*:\s*"(https:\/\/m\.media-amazon[^"]+)"/g)) add(m[1]);
  for (const m of html.matchAll(/data-old-hires="(https:\/\/m\.media-amazon[^"]+)"/g)) add(m[1]);
  for (const m of html.matchAll(/src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g)) add(m[1]);

  return out.slice(0, 3);
}

async function getImagesFromAsin(asin) {
  try {
    await sleep(3000 + Math.random() * 2000);
    const { status, body } = await request(`https://www.amazon.fr/dp/${asin}`, {
      headers: { 'Referer': 'https://www.google.fr/' }
    });
    if (status !== 200) {
      console.log(`    Amazon ${asin}: status ${status}`);
      return [];
    }
    return extractAmazonImages(body);
  } catch (e) {
    console.log(`    Amazon ${asin}: ${e.message}`);
    return [];
  }
}

// ── Source 2 : Amazon.fr recherche (trouve ASIN + images) ──────────────────

async function searchAmazonFr(brand, model) {
  try {
    const q = encodeURIComponent(`${brand} ${model}`);
    await sleep(2000 + Math.random() * 2000);
    const { status, body } = await request(`https://www.amazon.fr/s?k=${q}&l=fr_FR`, {
      headers: { 'Referer': 'https://www.google.fr/' }
    });
    if (status !== 200) return null;

    // Extraire le premier ASIN depuis les résultats
    const asinM = body.match(/data-asin="([A-Z0-9]{10})"/);
    if (asinM) return asinM[1];
    const urlM = body.match(/\/dp\/([A-Z0-9]{10})/);
    return urlM ? urlM[1] : null;
  } catch (e) {
    return null;
  }
}

// ── Source 3 : LDLC.com (retailer français, moins filtré) ──────────────────

function extractLDLCImages(html) {
  const seen = new Set();
  const out = [];

  const add = (url) => {
    if (!url || seen.has(url)) return;
    if (!url.match(/\.(jpg|png|webp)(\?|$)/i)) return;
    if (url.includes('logo') || url.includes('icon') || url.includes('sprite')) return;
    // Seulement les images "produit" (grandes images)
    if (!url.includes('static.ldlc') && !url.includes('ldlcstatic')) return;
    seen.add(url);
    out.push(url);
  };

  // Images principales LDLC
  for (const m of html.matchAll(/class="[^"]*(?:main-image|zoom|picture|gallery)[^"]*"[^>]*src="([^"]+)"/g)) add(m[1]);
  for (const m of html.matchAll(/data-src="(https?:\/\/[^"]*static\.ldlc[^"]*\.(jpg|png|webp))"/g)) add(m[1]);
  for (const m of html.matchAll(/src="(https?:\/\/static\.ldlc[^"]*\/[^"]*\.(jpg|png|webp))"/g)) add(m[1]);
  // Fallback: toutes les grandes images sur la page
  for (const m of html.matchAll(/https?:\/\/static\.ldlc\.com[^\s"'<>]+\.(jpg|png|webp)/g)) {
    if (!m[0].includes('thumb') && !m[0].includes('mini') && !m[0].includes('logo')) {
      add(m[0]);
    }
  }

  return out.slice(0, 3);
}

async function searchLDLC(brand, model) {
  try {
    const q = encodeURIComponent(`${brand} ${model}`);
    await sleep(1500 + Math.random() * 1000);
    const { status, body } = await request(`https://www.ldlc.com/recherche/${q}/`);
    if (status !== 200) return null;

    // Premier résultat produit
    const linkM = body.match(/href="(\/[a-z][^"]+\.html[^"]*)"/);
    if (!linkM) return null;
    const productUrl = 'https://www.ldlc.com' + linkM[1].split('"')[0];
    return productUrl;
  } catch (e) {
    return null;
  }
}

async function getLDLCImages(brand, model) {
  try {
    const productUrl = await searchLDLC(brand, model);
    if (!productUrl) return [];
    await sleep(1500 + Math.random() * 1000);
    const { status, body } = await request(productUrl);
    if (status !== 200) return [];
    const imgs = extractLDLCImages(body);
    return imgs;
  } catch (e) {
    return [];
  }
}

// ── Source 4 : DuckDuckGo (fallback ASIN lookup) ───────────────────────────

async function findAsinViaDDG(brand, model) {
  const queries = [
    `${brand} ${model} site:amazon.fr`,
    `${brand} ${model} amazon.fr ordinateur`,
  ];
  for (const q of queries) {
    try {
      await sleep(2500 + Math.random() * 1500);
      const { status, body } = await request(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=fr-fr`
      );
      if (status !== 200) continue;
      const m = body.match(/amazon\.fr\/[^"<\s]*\/dp\/([A-Z0-9]{10})|amazon\.fr\/dp\/([A-Z0-9]{10})/);
      if (m) return m[1] || m[2];
    } catch (e) { /* continuer */ }
  }
  return null;
}

// ── Orchestration ───────────────────────────────────────────────────────────

async function getGalleryForProduct(p, knownAsins) {
  const cleanName = p.name.replace(new RegExp(`^${p.brand}\\s+`, 'i'), '');
  const slug = p.slug || p.id || '';

  // 1. ASIN connu → Amazon product page directement
  const asin = knownAsins[slug] || knownAsins[p.id];
  if (asin) {
    console.log(`    ASIN connu: ${asin} → Amazon.fr`);
    const imgs = await getImagesFromAsin(asin);
    if (imgs.length >= 2) return { images: imgs, source: 'amazon-direct' };
  }

  // 2. Chercher ASIN via Amazon search
  console.log(`    Recherche ASIN via Amazon.fr search…`);
  const foundAsin = await searchAmazonFr(p.brand, cleanName);
  if (foundAsin) {
    console.log(`    ASIN trouvé: ${foundAsin} → images`);
    const imgs = await getImagesFromAsin(foundAsin);
    if (imgs.length >= 2) return { images: imgs, source: 'amazon-search', asin: foundAsin };
  }

  // 3. LDLC.com
  console.log(`    Essai LDLC.com…`);
  const ldlcImgs = await getLDLCImages(p.brand, cleanName);
  if (ldlcImgs.length >= 2) return { images: ldlcImgs, source: 'ldlc' };

  // 4. DuckDuckGo → ASIN → Amazon
  console.log(`    Recherche ASIN via DuckDuckGo…`);
  const ddgAsin = await findAsinViaDDG(p.brand, cleanName);
  if (ddgAsin) {
    console.log(`    ASIN DDG: ${ddgAsin}`);
    const imgs = await getImagesFromAsin(ddgAsin);
    if (imgs.length >= 2) return { images: imgs, source: 'ddg-amazon', asin: ddgAsin };
  }

  return { images: [], source: 'none' };
}

async function run() {
  // Charger ASINs connus
  let knownAsins = {};
  try {
    knownAsins = JSON.parse(
      require('fs').readFileSync(path.join(__dirname, 'asins.json'), 'utf8')
    );
    // Aplatir les catégories en slug → asin
    const flat = {};
    for (const cat of Object.values(knownAsins)) {
      if (typeof cat === 'object') {
        for (const [slug, asin] of Object.entries(cat)) {
          if (asin) flat[slug] = asin;
        }
      }
    }
    knownAsins = flat;
    console.log(`${Object.keys(knownAsins).length} ASINs connus chargés`);
  } catch (e) {
    console.log('asins.json non trouvé, recherche auto uniquement');
  }

  // Charger produits Supabase
  const { data: cats } = await supabase.from('categories').select('id,slug').in('slug', SUBCATEGORIES);
  const catIds = cats.map(c => c.id);
  const { data: products, error } = await supabase
    .from('products')
    .select('id, slug, name, brand, image, main_image_url, gallery, gallery_urls')
    .in('category_id', catIds)
    .eq('status', 'active');

  if (error) { console.error(error.message); process.exit(1); }

  // Filtrer ceux qui ont besoin d'une vraie galerie (3 images distinctes)
  const needs = products.filter(p => {
    const srcs = (p.gallery || []).map(g => typeof g === 'string' ? g : g?.src).filter(Boolean);
    const distinct = new Set(srcs).size;
    return srcs.length < 3 || distinct < 2 || srcs.some(s => s.includes('placehold'));
  });

  console.log(`\n${needs.length}/${products.length} produits sans galerie complète\n`);

  const foundAsins = {};
  let updated = 0;

  for (const p of needs) {
    const cleanName = p.name.replace(new RegExp(`^${p.brand}\\s+`, 'i'), '');
    console.log(`\n→ [${p.slug || p.id}] ${p.brand} ${cleanName}`);

    const { images, source, asin } = await getGalleryForProduct(p, knownAsins);

    if (asin) foundAsins[p.slug || p.id] = asin;

    if (images.length === 0) {
      console.log(`  ✗ Aucune image trouvée (toutes sources épuisées)`);
      continue;
    }

    // S'assurer que l'image principale est en premier
    const mainImg = p.main_image_url || p.image;
    if (mainImg && !images.includes(mainImg)) images.unshift(mainImg);
    const gallery = images.slice(0, 3).map(src => ({ src, alt: '' }));

    const { error: err } = await supabase.from('products').update({
      gallery,
      gallery_urls: gallery.map(g => g.src),
      image: images[0],
      main_image_url: images[0],
    }).eq('id', p.id);

    if (err) {
      console.log(`  ✗ Supabase update: ${err.message}`);
    } else {
      console.log(`  ✓ ${gallery.length} images [${source}]`);
      gallery.forEach((g, i) => console.log(`    [${i+1}] ${g.src.split('/').pop()}`));
      updated++;
    }
  }

  // Sauvegarder les ASINs nouvellement trouvés
  if (Object.keys(foundAsins).length > 0) {
    console.log(`\n💾 ${Object.keys(foundAsins).length} nouveaux ASINs trouvés → asins_found.json`);
    require('fs').writeFileSync(
      path.join(__dirname, 'asins_found.json'),
      JSON.stringify(foundAsins, null, 2)
    );
  }

  console.log(`\n✅ ${updated}/${needs.length} produits mis à jour`);
}

run().catch(console.error);
