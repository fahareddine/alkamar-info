#!/usr/bin/env node
// scripts/scrape-ecrans-images.js
// Scrape Amazon.fr — 3 images par angle pour chaque moniteur écran
// Stratégies : DuckDuckGo → Bing → Amazon direct search
// Usage: node scripts/scrape-ecrans-images.js

const https  = require('https');
const http   = require('http');
const path   = require('path');
const fs     = require('fs');

function loadEnv() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
    raw.split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    });
  } catch {}
}
loadEnv();

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const SUBCATEGORIES = ['ecran-fhd', 'ecran-4k', 'ecran-gaming', 'ecran-reco'];
const DELAY = 2500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        ...extraHeaders,
      },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        fetchUrl(res.headers.location, extraHeaders).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractAmazonImages(html) {
  const imgs = new Set();
  const patterns = [
    /"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g,
    /"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g,
    /data-old-hires="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g,
    /"mainUrl"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g,
    /data-a-dynamic-image="[^"]*?(https:\\\/\\\/m\.media-amazon\.com\\\/images\\\/I\\\/[^"]+?\.jpg)/g,
  ];
  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      let url = m[1].replace(/\\\//g, '/').replace(/\._[A-Z0-9,_]+_\./g, '.').replace(/\?.*$/, '');
      if (url.endsWith('.jpg') && url.length > 50) imgs.add(url);
    }
  }
  return [...imgs].slice(0, 5);
}

function extractAsinFromUrl(url) {
  const m = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
  return m ? m[1] : null;
}

// Stratégie 1: DuckDuckGo HTML
async function searchDDG(query) {
  const q = encodeURIComponent(query);
  try {
    const { body } = await fetchUrl(`https://html.duckduckgo.com/html/?q=${q}`);
    const matches = [...body.matchAll(/amazon\.fr\/(?:dp|gp\/product)\/([A-Z0-9]{10})/g)];
    return matches.length ? matches[0][1] : null;
  } catch { return null; }
}

// Stratégie 2: Bing search
async function searchBing(query) {
  const q = encodeURIComponent(query + ' site:amazon.fr');
  try {
    const { body } = await fetchUrl(`https://www.bing.com/search?q=${q}`, {
      'Referer': 'https://www.bing.com'
    });
    const m = body.match(/amazon\.fr\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    return m ? m[1] : null;
  } catch { return null; }
}

// Stratégie 3: Amazon search directe
async function searchAmazon(query) {
  const q = encodeURIComponent(query);
  try {
    const { body } = await fetchUrl(`https://www.amazon.fr/s?k=${q}`, {
      'Referer': 'https://www.amazon.fr'
    });
    const m = body.match(/\/dp\/([A-Z0-9]{10})\//);
    return m ? m[1] : null;
  } catch { return null; }
}

async function findAsin(brand, name) {
  const query = `${brand} ${name} moniteur`;
  console.log(`  → Recherche ASIN: "${query}"`);

  // Essai 1: DuckDuckGo
  let asin = await searchDDG(`site:amazon.fr ${query}`);
  if (asin) { console.log(`  → DDG: ${asin}`); return asin; }
  await sleep(800);

  // Essai 2: Bing
  asin = await searchBing(query);
  if (asin) { console.log(`  → Bing: ${asin}`); return asin; }
  await sleep(800);

  // Essai 3: Amazon search directe
  asin = await searchAmazon(query);
  if (asin) { console.log(`  → Amazon search: ${asin}`); return asin; }

  console.log(`  → Aucun ASIN trouvé`);
  return null;
}

async function fetchAmazonImages(asin) {
  await sleep(DELAY);
  try {
    const { status, body } = await fetchUrl(`https://www.amazon.fr/dp/${asin}`, {
      'Referer': 'https://www.amazon.fr',
      'Cookie': 'session-id=000-0000000-0000000; i18n-prefs=EUR',
    });
    console.log(`  → Amazon /dp/${asin} → HTTP ${status}`);
    if (status !== 200) return [];
    const imgs = extractAmazonImages(body);
    console.log(`  → ${imgs.length} image(s) extraite(s)`);
    return imgs;
  } catch (e) {
    console.log(`  → Erreur: ${e.message}`);
    return [];
  }
}

async function run() {
  const { data: cats } = await supabase
    .from('categories').select('id, slug').in('slug', SUBCATEGORIES);
  if (!cats?.length) { console.error('Catégories écrans non trouvées'); process.exit(1); }

  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, slug, image, gallery, gallery_urls')
    .in('category_id', cats.map(c => c.id))
    .eq('status', 'active');

  console.log(`\n${products.length} produits à traiter\n`);
  let updated = 0, failed = 0;

  for (const p of products) {
    // Vérifier si galerie réelle déjà présente
    const existingGallery = p.gallery || [];
    const galSrcs = existingGallery.map(g => typeof g === 'string' ? g : g?.src).filter(Boolean);
    const hasRealGallery = galSrcs.length >= 2 &&
      galSrcs.every(s => s.includes('m.media-amazon.com'));

    if (hasRealGallery) {
      console.log(`✓ ${p.brand} ${p.name} — galerie Amazon OK`);
      continue;
    }

    console.log(`\n[${p.slug}] ${p.brand} — ${p.name}`);

    // Trouver ASIN
    const asin = await findAsin(p.brand || '', p.name);
    if (!asin) { failed++; continue; }

    // Récupérer images Amazon
    const imgs = await fetchAmazonImages(asin);
    if (!imgs.length) { failed++; continue; }

    // Préparer la galerie avec 3 images minimum
    const galleryImgs = imgs.slice(0, 3);
    while (galleryImgs.length < 3) galleryImgs.push(galleryImgs[0]);

    const gallery = galleryImgs.map((src, i) => ({
      src,
      alt: `${p.name} — ${['Vue principale', 'Vue de côté', 'Vue détail'][i] || 'Vue ' + (i+1)}`
    }));

    const { error } = await supabase.from('products').update({
      image: galleryImgs[0],
      main_image_url: galleryImgs[0],
      gallery,
      gallery_urls: galleryImgs,
    }).eq('id', p.id);

    if (error) {
      console.log(`  ✗ Update: ${error.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${galleryImgs.length} images sauvegardées`);
      galleryImgs.forEach(u => console.log('    -', u.split('/I/')[1]?.slice(0, 20) || u.slice(-30)));
      updated++;
    }

    await sleep(DELAY);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ ${updated} mis à jour, ❌ ${failed} échecs`);
}

run().catch(console.error);
