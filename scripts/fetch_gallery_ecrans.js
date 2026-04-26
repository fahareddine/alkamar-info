// scripts/fetch_gallery_ecrans.js
// Scrape Amazon.fr pour récupérer 3 images par moniteur écran
// Usage: node scripts/fetch_gallery_ecrans.js

const https = require('https');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const SUBCATEGORIES = ['ecran-fhd', 'ecran-4k', 'ecran-gaming', 'ecran-reco'];
const DELAY_MS = 1800;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
        ...headers,
      },
    };
    const req = https.get(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractImages(html) {
  const images = new Set();
  const patterns = [
    /"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g,
    /"large":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g,
    /data-old-hires="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g,
  ];
  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      images.add(m[1].replace(/\._AC_[A-Z0-9,_]+_/g, ''));
    }
  }
  return [...images].filter(u => u.length > 50).slice(0, 3);
}

async function searchAsin(brand, name) {
  const q = encodeURIComponent(`site:amazon.fr ${brand} ${name}`);
  try {
    const { body } = await fetchUrl(`https://html.duckduckgo.com/html/?q=${q}`);
    const m = body.match(/amazon\.fr\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function getImages(brand, name, currentImage) {
  const asin = await searchAsin(brand, name);
  if (!asin) { console.log(`  ✗ ASIN non trouvé pour ${brand} ${name}`); return null; }
  await sleep(DELAY_MS);
  try {
    const { body, status } = await fetchUrl(`https://www.amazon.fr/dp/${asin}`);
    if (status !== 200) { console.log(`  ✗ Amazon status ${status} pour ${asin}`); return null; }
    const imgs = extractImages(body);
    if (!imgs.length) { console.log(`  ✗ Aucune image Amazon sur ${asin}`); return null; }
    if (currentImage && !imgs.includes(currentImage)) imgs.unshift(currentImage);
    return imgs.slice(0, 3);
  } catch (e) {
    console.log(`  ✗ Erreur ${asin}: ${e.message}`);
    return null;
  }
}

async function run() {
  const { data: cats } = await supabase
    .from('categories').select('id, slug').in('slug', SUBCATEGORIES);
  if (!cats?.length) {
    console.error('Catégories écrans non trouvées — lancez import-ecrans.js d\'abord');
    process.exit(1);
  }

  const catIds = cats.map(c => c.id);
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, brand, image, gallery')
    .in('category_id', catIds)
    .eq('status', 'active');

  if (error) { console.error('Erreur Supabase:', error.message); process.exit(1); }
  console.log(`${products.length} produit(s) à traiter\n`);

  let updated = 0, fallback = 0;

  for (const p of products) {
    const galSrcs = (p.gallery || []).map(g => typeof g === 'string' ? g : g?.src).filter(Boolean);
    const hasReal = galSrcs.length >= 2 && galSrcs.every(s => s.includes('amazon') && !s.includes('placehold'));
    if (hasReal) { console.log(`  ✓ ${p.name} — galerie OK`); continue; }

    console.log(`Traitement: ${p.brand} ${p.name}`);
    await sleep(DELAY_MS);

    const imgs = await getImages(p.brand, p.name, p.image);
    if (!imgs?.length) {
      const fb = [p.image, p.image, p.image].filter(Boolean);
      if (fb.length) {
        await supabase.from('products').update({ gallery: fb.map(src => ({ src, alt: '' })) }).eq('id', p.id);
        console.log(`  → fallback (3× image principale)`);
      }
      fallback++;
      continue;
    }

    const gallery = imgs.map((src, i) => ({ src, alt: `${p.name} — vue ${i + 1}` }));
    const { error: e } = await supabase.from('products')
      .update({ gallery, image: imgs[0], main_image_url: imgs[0] })
      .eq('id', p.id);

    if (e) { console.log(`  ✗ Update: ${e.message}`); fallback++; }
    else   { console.log(`  ✓ ${imgs.length} images`); updated++; }
  }

  console.log(`\n✅ ${updated} mis à jour, ${fallback} fallback(s)`);
}

run().catch(console.error);
