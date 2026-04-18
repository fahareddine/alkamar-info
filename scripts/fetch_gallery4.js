// scripts/fetch_gallery4.js — Galerie via Bing Images + Amazon direct (ASIN)
// Usage: node scripts/fetch_gallery4.js
// Exécuter en LOCAL

const https = require('https');
const http = require('http');
const fs = require('fs');
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
    if (!url || !url.startsWith('http')) return reject(new Error('URL invalide: ' + url));
    const mod = url.startsWith('https') ? https : http;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'Accept-Encoding': 'identity',
      ...opts.headers,
    };
    const req = mod.get(url, { headers }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location;
        if (!loc) return reject(new Error('redirect sans location'));
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        return request(next, opts).then(resolve).catch(reject);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function cleanAmazonUrl(url) {
  return url
    .replace(/\._[A-Z0-9_]+_\./g, '.')  // supprime ._AC_SL1500_. ._AC_UL320_. etc.
    .replace(/\?.*$/, '');               // supprime query string
}

// ── Source 1 : Amazon.fr product page (ASIN connu) ─────────────────────────

function extractAmazonImages(html) {
  const seen = new Set();
  const out = [];
  const add = (raw) => {
    if (!raw || !raw.includes('m.media-amazon.com')) return;
    const clean = cleanAmazonUrl(raw);
    if (!clean.match(/\.(jpg|png)$/i)) return;
    if (seen.has(clean)) return;
    seen.add(clean);
    out.push(clean);
  };
  for (const m of html.matchAll(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon[^"]+)"/g)) add(m[1]);
  for (const m of html.matchAll(/"large"\s*:\s*"(https:\/\/m\.media-amazon[^"]+)"/g)) add(m[1]);
  for (const m of html.matchAll(/data-old-hires="(https:\/\/m\.media-amazon[^"]+)"/g)) add(m[1]);
  return out.slice(0, 3);
}

async function getImagesFromAsin(asin) {
  try {
    await sleep(2000 + Math.random() * 2000);
    const { status, body } = await request(`https://www.amazon.fr/dp/${asin}`, {
      headers: { 'Referer': 'https://www.google.fr/', 'Cache-Control': 'no-cache' }
    });
    if (status !== 200) { console.log(`    Amazon ${asin}: ${status}`); return []; }
    return extractAmazonImages(body);
  } catch (e) {
    console.log(`    Amazon ${asin}: ${e.message}`);
    return [];
  }
}

// ── Source 2 : Bing Images ──────────────────────────────────────────────────

function extractBingImages(html) {
  const seen = new Set();
  const out = [];

  // Bing embed les URLs sources dans des attributs data
  const patterns = [
    /"murl"\s*:\s*"(https?:\/\/[^"]+\.(jpg|png|jpeg))"/g,
    /imgurl=([^&"']+\.(jpg|png|jpeg))/g,
  ];

  for (const pat of patterns) {
    for (const m of html.matchAll(pat)) {
      try {
        let url = decodeURIComponent(m[1]);
        if (url.includes('microsoft') || url.includes('bing') || url.includes('w3.org')) continue;
        if (url.includes('logo') || url.includes('icon') || url.includes('sprite')) continue;
        url = url.split('&')[0].split('"')[0];
        if (!seen.has(url)) { seen.add(url); out.push(url); }
      } catch (e) { /* URL decode failed */ }
    }
    if (out.length >= 3) break;
  }

  return out.slice(0, 3);
}

async function getBingImages(brand, model) {
  try {
    const q = encodeURIComponent(`${brand} ${model} ordinateur portable`);
    await sleep(1500 + Math.random() * 1500);
    const { status, body } = await request(
      `https://www.bing.com/images/search?q=${q}&qft=+filterui:imagesize-large&FORM=HDRSC2`,
      { headers: { 'Referer': 'https://www.bing.com/' } }
    );
    if (status !== 200) { console.log(`    Bing: ${status}`); return []; }
    return extractBingImages(body);
  } catch (e) {
    console.log(`    Bing: ${e.message}`);
    return [];
  }
}

// ── Source 3 : Amazon search → ASIN → product page ─────────────────────────

async function findAsinAndImages(brand, model) {
  try {
    const q = encodeURIComponent(`${brand} ${model}`);
    await sleep(2000 + Math.random() * 2000);
    const { status, body } = await request(
      `https://www.amazon.fr/s?k=${q}`,
      { headers: { 'Referer': 'https://www.google.fr/' } }
    );
    if (status !== 200) { console.log(`    Amazon search: ${status}`); return { asin: null, images: [] }; }

    // Chercher ASIN dans les résultats
    let asin = null;
    const m1 = body.match(/data-asin="([A-Z0-9]{10})"/);
    const m2 = body.match(/"asin"\s*:\s*"([A-Z0-9]{10})"/);
    const m3 = body.match(/\/dp\/([A-Z0-9]{10})/);
    asin = (m1 && m1[1]) || (m2 && m2[1]) || (m3 && m3[1]) || null;

    if (!asin) { console.log(`    Amazon search: ASIN non trouvé`); return { asin: null, images: [] }; }
    console.log(`    ASIN trouvé via search: ${asin}`);

    const images = await getImagesFromAsin(asin);
    return { asin, images };
  } catch (e) {
    console.log(`    Amazon search: ${e.message}`);
    return { asin: null, images: [] };
  }
}

// ── Orchestration ───────────────────────────────────────────────────────────

async function run() {
  // Charger ASINs connus
  let knownAsins = {};
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'asins.json'), 'utf8'));
    for (const cat of Object.values(raw)) {
      if (typeof cat === 'object') {
        for (const [slug, asin] of Object.entries(cat)) {
          if (asin) knownAsins[slug] = asin;
        }
      }
    }
    console.log(`${Object.keys(knownAsins).length} ASINs connus chargés`);
  } catch (e) { /* pas de asins.json */ }

  const { data: cats } = await supabase.from('categories').select('id,slug').in('slug', SUBCATEGORIES);
  const catIds = cats.map(c => c.id);
  const { data: products, error } = await supabase
    .from('products')
    .select('id, slug, name, brand, image, main_image_url, gallery, gallery_urls')
    .in('category_id', catIds)
    .eq('status', 'active');

  if (error) { console.error(error.message); process.exit(1); }

  const needs = products.filter(p => {
    const srcs = (p.gallery || []).map(g => typeof g === 'string' ? g : g?.src).filter(Boolean);
    return new Set(srcs).size < 2;
  });

  console.log(`\n${needs.length}/${products.length} produits sans galerie distincte\n`);

  const foundAsins = { ...knownAsins };
  let updated = 0;
  let failed = 0;

  for (const p of needs) {
    const cleanName = p.name.replace(new RegExp(`^${p.brand}\\s+`, 'i'), '');
    console.log(`\n→ [${p.slug}] ${p.brand} ${cleanName}`);

    let images = [];
    let source = '';

    // 1. ASIN connu
    if (knownAsins[p.slug]) {
      console.log(`  ASIN connu: ${knownAsins[p.slug]}`);
      images = await getImagesFromAsin(knownAsins[p.slug]);
      source = 'amazon-direct';
    }

    // 2. Bing Images
    if (images.length < 2) {
      console.log(`  Bing Images…`);
      images = await getBingImages(p.brand, cleanName);
      source = 'bing';
    }

    // 3. Amazon search
    if (images.length < 2) {
      console.log(`  Amazon search…`);
      const { asin, images: amzImgs } = await findAsinAndImages(p.brand, cleanName);
      if (asin) foundAsins[p.slug] = asin;
      if (amzImgs.length >= 2) { images = amzImgs; source = 'amazon-search'; }
    }

    if (images.length === 0) {
      console.log(`  ✗ Aucune image`);
      failed++;
      continue;
    }

    // Image principale en premier si pas déjà là
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
      console.log(`  ✗ Update: ${err.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${gallery.length} images [${source}]`);
      gallery.forEach((g, i) => console.log(`    [${i+1}] ${g.src.split('/').slice(-1)[0]}`));
      updated++;
    }
  }

  // Sauvegarder ASINs découverts
  const newAsins = Object.entries(foundAsins).filter(([k, v]) => !knownAsins[k] && v);
  if (newAsins.length > 0) {
    fs.writeFileSync(path.join(__dirname, 'asins_found.json'), JSON.stringify(Object.fromEntries(newAsins), null, 2));
    console.log(`\n💾 ${newAsins.length} nouveaux ASINs → asins_found.json`);
  }

  console.log(`\n✅ ${updated} mis à jour, ${failed} échecs`);
}

run().catch(console.error);
