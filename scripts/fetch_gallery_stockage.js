// scripts/fetch_gallery_stockage.js — Galerie images pour produits Stockage
// Usage: node scripts/fetch_gallery_stockage.js
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

const SUBCATEGORY_SLUGS = ['cle-usb', 'ssd-externe', 'ssd-interne', 'hdd', 'carte-memoire', 'nas'];

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
    .replace(/\._[A-Z0-9_]+_\./g, '.')
    .replace(/\?.*$/, '');
}

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
    if (status !== 200) { console.log(`    Amazon ${asin}: HTTP ${status}`); return []; }
    const imgs = extractAmazonImages(body);
    console.log(`    Amazon ASIN ${asin}: ${imgs.length} images`);
    return imgs;
  } catch (e) {
    console.log(`    Amazon ${asin}: ${e.message}`);
    return [];
  }
}

async function findAsinAndImages(brand, name) {
  try {
    const q = encodeURIComponent(`${brand} ${name}`);
    await sleep(2000 + Math.random() * 2000);
    const { status, body } = await request(
      `https://www.amazon.fr/s?k=${q}`,
      { headers: { 'Referer': 'https://www.google.fr/' } }
    );
    if (status !== 200) { console.log(`    Amazon search: HTTP ${status}`); return { asin: null, images: [] }; }

    const m1 = body.match(/data-asin="([A-Z0-9]{10})"/);
    const m2 = body.match(/"asin"\s*:\s*"([A-Z0-9]{10})"/);
    const m3 = body.match(/\/dp\/([A-Z0-9]{10})/);
    const asin = (m1 && m1[1]) || (m2 && m2[1]) || (m3 && m3[1]) || null;

    if (!asin) { console.log(`    Amazon search: ASIN non trouvé`); return { asin: null, images: [] }; }
    console.log(`    ASIN trouvé: ${asin}`);

    const images = await getImagesFromAsin(asin);
    return { asin, images };
  } catch (e) {
    console.log(`    Amazon search: ${e.message}`);
    return { asin: null, images: [] };
  }
}

async function run() {
  const { data: cats } = await supabase.from('categories').select('id,slug').in('slug', SUBCATEGORY_SLUGS);
  if (!cats || cats.length === 0) { console.error('Catégories non trouvées'); process.exit(1); }
  const catIds = cats.map(c => c.id);

  const { data: products, error } = await supabase
    .from('products')
    .select('id, slug, name, brand, image, main_image_url, gallery, gallery_urls, categories(slug)')
    .in('category_id', catIds)
    .eq('status', 'active');

  if (error) { console.error(error.message); process.exit(1); }

  const needs = products.filter(p => {
    const urls = (p.gallery_urls || []).filter(Boolean);
    const gallery = (p.gallery || []).map(g => typeof g === 'string' ? g : g?.src).filter(Boolean);
    return new Set([...urls, ...gallery]).size < 2;
  });

  console.log(`\n${needs.length}/${products.length} produits sans galerie distincte\n`);

  const foundAsins = {};
  let updated = 0;
  let failed = 0;

  for (const p of needs) {
    const cleanName = p.name.replace(new RegExp(`^${(p.brand || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'), '');
    console.log(`\n→ [${p.categories?.slug}] ${p.brand} ${cleanName}`);

    let images = [];

    const { asin, images: amzImgs } = await findAsinAndImages(p.brand || '', cleanName);
    if (asin) foundAsins[p.slug] = asin;
    if (amzImgs.length >= 1) images = amzImgs;

    // Toujours inclure l'image principale existante
    const mainImg = p.main_image_url || p.image;
    if (mainImg && !images.includes(mainImg)) images.unshift(mainImg);

    if (images.length === 0) {
      console.log(`  ✗ Aucune image trouvée`);
      failed++;
      continue;
    }

    const gallery = images.slice(0, 3).map(src => ({ src, alt: '' }));
    const { error: err } = await supabase.from('products').update({
      gallery,
      gallery_urls: gallery.map(g => g.src),
      image: images[0],
      main_image_url: images[0],
    }).eq('id', p.id);

    if (err) {
      console.log(`  ✗ Update Supabase: ${err.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${gallery.length} images`);
      gallery.forEach((g, i) => console.log(`    [${i + 1}] ${g.src}`));
      updated++;
    }
  }

  if (Object.keys(foundAsins).length > 0) {
    fs.writeFileSync(path.join(__dirname, 'asins_stockage.json'), JSON.stringify(foundAsins, null, 2));
    console.log(`\n💾 ${Object.keys(foundAsins).length} ASINs → asins_stockage.json`);
  }

  console.log(`\n✅ ${updated} mis à jour, ${failed} échecs`);
}

run().catch(console.error);
