#!/usr/bin/env node
// scripts/fetch_ecrans_direct.js
// Fetch images Amazon directement par ASIN connu + met à jour brand manquant
// Usage: node scripts/fetch_ecrans_direct.js

const https = require('https');
const path  = require('path');
const fs    = require('fs');

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

// ASIN connus pour les 5 moniteurs
const SLUG_ASIN = {
  'aoc-24g2':           { asin: 'B07N4DL91T', brand: 'AOC' },
  'dell-s2421h':        { asin: 'B08JVSB44Q', brand: 'Dell' },
  'lg-27up850n':        { asin: 'B097FBWVMK', brand: 'LG' },
  'lg-27gp850-b':       { asin: 'B08T6XFVXM', brand: 'LG' },
  'msi-optix-mag274qrf':{ asin: 'B09TMDTM6L', brand: 'MSI' },
};

const DELAY_MS = 2000;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'identity',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractImages(html) {
  const images = new Set();
  const patterns = [
    /"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g,
    /"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g,
    /data-old-hires="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g,
    /"mainUrl"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g,
  ];
  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      const clean = m[1].replace(/\._[A-Z0-9,_]+_\./g, '.').replace(/\?.*$/, '');
      if (clean.endsWith('.jpg')) images.add(clean);
    }
  }
  return [...images].filter(u => u.length > 50).slice(0, 3);
}

async function main() {
  const slugs = Object.keys(SLUG_ASIN);
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, brand, slug, image')
    .in('slug', slugs);

  if (error) { console.error('Erreur Supabase:', error.message); process.exit(1); }
  console.log(`${products.length} produit(s) trouvé(s)\n`);

  let updated = 0;

  for (const p of products) {
    const info = SLUG_ASIN[p.slug];
    if (!info) { console.log(`⚠ ${p.slug} non dans SLUG_ASIN`); continue; }

    console.log(`Traitement: ${info.brand} — ${p.name} (ASIN: ${info.asin})`);

    const updates = {};

    // Corriger brand si null
    if (!p.brand) {
      updates.brand = info.brand;
      console.log(`  → brand fixé: ${info.brand}`);
    }

    // Fetch images Amazon
    await sleep(DELAY_MS);
    try {
      const { status, body } = await fetchUrl(`https://www.amazon.fr/dp/${info.asin}`);
      console.log(`  → Amazon HTTP ${status}`);

      if (status === 200) {
        const imgs = extractImages(body);
        console.log(`  → ${imgs.length} image(s) extraite(s)`);
        if (imgs.length > 0) {
          updates.image = imgs[0];
          updates.main_image_url = imgs[0];
          updates.gallery = imgs.map((src, i) => ({
            src,
            alt: `${p.name} — vue ${i + 1}`
          }));
        } else {
          // Fallback: image placehold colorée selon catégorie
          console.log(`  → Aucune image extraite — placeholder maintenu`);
        }
      } else if (status === 301 || status === 302) {
        console.log(`  → Redirigé (bot détecté) — placeholder maintenu`);
      } else {
        console.log(`  → Status ${status} — placeholder maintenu`);
      }
    } catch (e) {
      console.log(`  → Erreur fetch: ${e.message} — placeholder maintenu`);
    }

    if (Object.keys(updates).length > 0) {
      const { error: ue } = await supabase.from('products').update(updates).eq('id', p.id);
      if (ue) console.log(`  ✗ Update: ${ue.message}`);
      else { console.log(`  ✓ Mis à jour`); updated++; }
    } else {
      console.log(`  → Rien à modifier`);
    }
    console.log('');
  }

  console.log(`\n✅ ${updated} produit(s) mis à jour`);
}

main().catch(console.error);
