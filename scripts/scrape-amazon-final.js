#!/usr/bin/env node
// scripts/scrape-amazon-final.js
// Recherche Amazon.fr → ASIN → 3 images par moniteur via Playwright
// Usage: node scripts/scrape-amazon-final.js

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

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

// Requêtes Amazon optimisées par slug
const SEARCH_QUERIES = {
  'aoc-24g2':                  'AOC 24G2 moniteur IPS 144Hz',
  'dell-s2421h':               'Dell S2421H moniteur 24 FHD',
  'benq-gw2780':               'BenQ GW2780 moniteur 27 Full HD Eye Care',
  'lg-24mk430h':               'LG 24MK430H moniteur 24 Full HD',
  'philips-27e1n3300':         'Philips 27E1N3300 moniteur 27 USB-C',
  'lg-27up850n':               'LG 27UP850 moniteur 27 4K USB-C',
  'dell-u2723qe':              'Dell UltraSharp U2723QE moniteur 27 4K IPS Black',
  'lg-32un880-p':              'LG 32UN880 moniteur 32 4K Ergo bras',
  'samsung-32-4k-m7':         'Samsung Smart Monitor M7 32 4K',
  'asus-proart-pa32ucg':       'ASUS ProArt PA32UCG moniteur 32 4K Mini LED',
  'lg-27gp850-b':              'LG 27GP850 UltraGear Gaming 27 QHD 165Hz',
  'msi-optix-mag274qrf':       'MSI MAG274QRF moniteur 27 QHD 165Hz',
  'alienware-aw2723df':        'Alienware AW2723DF moniteur 27 280Hz QHD',
  'samsung-odyssey-neo-g7-32': 'Samsung Odyssey Neo G7 32 4K 165Hz',
  'ecran-dell-24-fhd-reco':    'Dell moniteur 24 Full HD reconditionné occasion',
  'ecran-hp-27-4k-reco':       'HP moniteur 27 4K reconditionné occasion',
  'ecran-lg-34-ultrawide-reco':'LG UltraWide 34 moniteur reconditionné occasion',
  'ecran-samsung-27-144hz-reco':'Samsung moniteur 27 144Hz reconditionné occasion',
  'ecran-benq-32-4k-reco':     'BenQ moniteur 32 4K reconditionné occasion',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function searchAndGetImages(page, slug, query) {
  console.log(`\n[${slug}]`);
  console.log(`  Recherche: "${query}"`);

  // 1. Rechercher sur Amazon.fr
  await page.goto(`https://www.amazon.fr/s?k=${encodeURIComponent(query)}`, {
    waitUntil: 'domcontentloaded', timeout: 25000
  });
  await sleep(1500);

  // Extraire ASIN du premier résultat
  const firstLink = await page.locator(
    '[data-component-type="s-search-result"] a.a-link-normal[href*="/dp/"]'
  ).first().getAttribute('href').catch(() => null);

  const asin = firstLink?.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
  if (!asin) {
    console.log(`  ✗ Aucun résultat`);
    return [];
  }

  const firstTitle = await page.locator(
    '[data-component-type="s-search-result"] h2 span'
  ).first().textContent().catch(() => '');
  console.log(`  → ASIN: ${asin} | ${firstTitle.trim().slice(0, 55)}`);

  // 2. Ouvrir la page produit
  await sleep(1200);
  await page.goto(`https://www.amazon.fr/dp/${asin}`, {
    waitUntil: 'domcontentloaded', timeout: 25000
  });
  await sleep(2500);

  // Cliquer sur les thumbnails pour charger les hiRes
  const thumbs = page.locator('#altImages li.item img, .imageThumbnail img');
  const thumbCount = await thumbs.count().catch(() => 0);
  for (let i = 0; i < Math.min(thumbCount, 5); i++) {
    await thumbs.nth(i).click({ force: true }).catch(() => {});
    await sleep(400);
  }
  await sleep(800);

  // 3. Extraire les images
  const images = await page.evaluate(() => {
    const imgs = new Set();

    // JSON inline — hiRes et large
    for (const s of document.querySelectorAll('script')) {
      const t = s.textContent || '';
      for (const m of t.matchAll(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
        imgs.add(m[1].replace(/\._[A-Z0-9,_]+_\./g, '.'));
      for (const m of t.matchAll(/"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
        imgs.add(m[1].replace(/\._[A-Z0-9,_]+_\./g, '.'));
    }

    // data-old-hires
    document.querySelectorAll('[data-old-hires]').forEach(el => {
      const s = el.getAttribute('data-old-hires');
      if (s?.includes('m.media-amazon.com')) imgs.add(s.replace(/\._[A-Z0-9,_]+_\./g, '.'));
    });

    // Image principale
    const main = document.querySelector('#landingImage, #imgTagWrapperId img');
    if (main) {
      const s = main.getAttribute('data-old-hires') || main.src || '';
      if (s.includes('m.media-amazon.com')) imgs.add(s.replace(/\._[A-Z0-9,_]+_\./g, '.'));
    }

    // Thumbnails
    document.querySelectorAll('#altImages img, .imageThumbnail img').forEach(img => {
      let s = img.getAttribute('data-old-hires') || img.getAttribute('src') || '';
      s = s.replace(/\._[A-Z0-9,_]+_\./g, '.');
      if (s.includes('m.media-amazon.com') && s.endsWith('.jpg')) imgs.add(s);
    });

    return [...imgs].filter(u =>
      u.length > 50 &&
      !u.includes('sprite') &&
      !u.includes('transparent') &&
      !u.includes('loading') &&
      u.includes('/I/')
    );
  });

  console.log(`  → ${images.length} image(s) Amazon extraite(s)`);
  return images.slice(0, 5);
}

async function run() {
  const SUBCATS = ['ecran-fhd', 'ecran-4k', 'ecran-gaming', 'ecran-reco'];
  const { data: cats } = await supabase
    .from('categories').select('id').in('slug', SUBCATS);
  const catIds = cats.map(c => c.id);

  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, slug, image, gallery')
    .in('category_id', catIds)
    .eq('status', 'active');

  console.log(`${products.length} produits à traiter`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const ctx = await browser.newContext({
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  let updated = 0, skipped = 0, failed = 0;

  for (const p of products) {
    // Skip galerie Amazon déjà OK
    const galSrcs = (p.gallery || []).map(g => typeof g === 'string' ? g : g?.src).filter(Boolean);
    if (galSrcs.length >= 2 && galSrcs.every(s => s.includes('m.media-amazon.com'))) {
      console.log(`\n✓ ${p.name} — galerie OK`);
      skipped++;
      continue;
    }

    const query = SEARCH_QUERIES[p.slug];
    if (!query) {
      console.log(`\n⚠ ${p.slug} — pas de query définie`);
      failed++;
      continue;
    }

    try {
      const imgs = await searchAndGetImages(page, p.slug, query);

      if (!imgs.length) {
        failed++;
        await sleep(2000);
        continue;
      }

      const gallery3 = imgs.slice(0, 3);
      while (gallery3.length < 3) gallery3.push(gallery3[0]);

      const gallery = gallery3.map((src, i) => ({
        src,
        alt: `${p.name} — ${['Vue principale', 'Vue de côté', 'Vue détail'][i]}`
      }));

      const { error } = await supabase.from('products').update({
        image:          gallery3[0],
        main_image_url: gallery3[0],
        gallery,
        gallery_urls:   gallery3,
      }).eq('id', p.id);

      if (error) { console.log(`  ✗ DB: ${error.message}`); failed++; }
      else {
        console.log(`  ✓ Sauvegardé:`);
        gallery3.forEach((u, i) => console.log(`    [${i+1}]`, u.split('/I/')[1]?.slice(0, 28) || u.slice(-35)));
        updated++;
      }
    } catch (e) {
      console.log(`  ✗ Erreur: ${e.message}`);
      failed++;
    }

    await sleep(2500);
  }

  await browser.close();
  console.log(`\n${'━'.repeat(44)}`);
  console.log(`✅ ${updated} images | ✓ ${skipped} déjà OK | ❌ ${failed} échecs`);
}

run().catch(e => { console.error(e); process.exit(1); });
