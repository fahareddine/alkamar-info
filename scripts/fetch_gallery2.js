// scripts/fetch_gallery2.js — Scrape Amazon.fr pour 3 images distinctes par produit
// Usage: node scripts/fetch_gallery2.js
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

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8',
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      ...opts.headers,
    };
    const req = mod.get(url, { headers }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location, opts).then(resolve).catch(reject);
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

function extractAllImages(html) {
  const images = [];
  const seen = new Set();

  const add = (url) => {
    if (!url || !url.includes('m.media-amazon.com') || seen.has(url)) return;
    const clean = url.replace(/\._AC_[A-Z0-9]+_/g, '').replace(/\._SX[0-9]+_/g, '').replace(/\._SY[0-9]+_/g, '');
    if (!seen.has(clean) && clean.endsWith('.jpg')) {
      seen.add(clean);
      images.push(clean);
    }
  };

  // hiRes images in JSON
  for (const m of html.matchAll(/"hiRes":"(https:\/\/m\.media-amazon[^"]+\.jpg)"/g)) add(m[1]);
  // colorImages
  for (const m of html.matchAll(/"large":"(https:\/\/m\.media-amazon[^"]+\.jpg)"/g)) add(m[1]);
  // data-old-hires
  for (const m of html.matchAll(/data-old-hires="(https:\/\/m\.media-amazon[^"]+\.jpg)"/g)) add(m[1]);
  // img src
  for (const m of html.matchAll(/src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g)) add(m[1]);

  return images.slice(0, 3);
}

async function getAsinViaGoogle(brand, name) {
  // Try multiple search approaches
  const queries = [
    `${brand} ${name} site:amazon.fr`,
    `${brand} ${name} amazon.fr`,
  ];
  for (const q of queries) {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=fr-fr`;
      await sleep(2000 + Math.random() * 1000);
      const { status, body } = await fetch(url);
      if (status !== 200) continue;
      const m = body.match(/amazon\.fr\/[^"<\s]*\/dp\/([A-Z0-9]{10})|amazon\.fr\/dp\/([A-Z0-9]{10})/);
      if (m) return m[1] || m[2];
    } catch (e) { /* continue */ }
  }
  return null;
}

async function getImagesFromAsin(asin) {
  try {
    await sleep(2000 + Math.random() * 2000);
    const url = `https://www.amazon.fr/dp/${asin}`;
    const { status, body } = await fetch(url, {
      headers: { 'Referer': 'https://www.google.fr/' }
    });
    if (status !== 200) return [];
    return extractAllImages(body);
  } catch (e) {
    return [];
  }
}

async function run() {
  const { data: cats } = await supabase.from('categories').select('id,slug').in('slug', SUBCATEGORIES);
  const catIds = cats.map(c => c.id);
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, brand, image, gallery')
    .in('category_id', catIds)
    .eq('status', 'active');

  if (error) { console.error(error.message); process.exit(1); }

  // Filter only products needing real gallery
  const needsGallery = products.filter(p => {
    const srcs = (p.gallery || []).map(g => typeof g === 'string' ? g : g?.src).filter(Boolean);
    const distinct = new Set(srcs).size;
    return srcs.length < 3 || distinct < 2 || srcs.some(s => s.includes('placehold.co'));
  });

  console.log(`${needsGallery.length}/${products.length} produits nécessitent une galerie réelle`);

  let updated = 0;
  for (const p of needsGallery) {
    // Clean brand from name (avoid "Dell Dell Inspiron")
    const cleanName = p.name.replace(new RegExp('^' + p.brand + '\\s+', 'i'), '');
    console.log(`\n→ ${p.brand} ${cleanName}`);

    const asin = await getAsinViaGoogle(p.brand, cleanName);
    if (!asin) {
      console.log('  ✗ ASIN non trouvé');
      continue;
    }
    console.log(`  ASIN: ${asin}`);

    const images = await getImagesFromAsin(asin);
    if (images.length === 0) {
      console.log(`  ✗ Aucune image trouvée sur page Amazon`);
      continue;
    }

    // Ensure main image is first
    if (p.image && !images.includes(p.image)) images.unshift(p.image);
    const gallery = images.slice(0, 3).map(src => ({ src, alt: '' }));

    const { error: err } = await supabase.from('products').update({
      gallery,
      image: images[0],
    }).eq('id', p.id);

    if (err) {
      console.log(`  ✗ Update: ${err.message}`);
    } else {
      console.log(`  ✓ ${gallery.length} images distinctes`);
      gallery.forEach((g, i) => console.log(`    [${i+1}] ${g.src.split('/I/')[1]}`));
      updated++;
    }
  }

  console.log(`\n✅ ${updated}/${needsGallery.length} produits mis à jour`);
}

run().catch(console.error);
