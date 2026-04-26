#!/usr/bin/env node
// scripts/scrape-ecrans-playwright.js
// Scrape Amazon.fr avec Playwright (vrai Chrome) — 3 images par moniteur
// Usage: node scripts/scrape-ecrans-playwright.js

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

const SUBCATS = ['ecran-fhd', 'ecran-4k', 'ecran-gaming', 'ecran-reco'];
const DELAY   = 3000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function asinFromUrl(url) {
  if (!url) return null;
  const m = url.match(/\/dp\/([A-Z0-9]{10})/);
  return m ? m[1] : null;
}

async function scrapeAmazonPage(page, asin) {
  const url = `https://www.amazon.fr/dp/${asin}`;
  console.log(`  → ${url}`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    // Attendre les images
    await page.waitForSelector('#imgTagWrapperId, #landingImage, #main-image', { timeout: 10000 }).catch(() => {});

    // Extraire via JS dans la page — chercher dans colorImages JSON et thumbnails
    const images = await page.evaluate(() => {
      const imgs = new Set();

      // 1. Données JSON inline colorImages
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const text = s.textContent || '';
        // hiRes
        for (const m of text.matchAll(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g)) {
          imgs.add(m[1].replace(/\._[A-Z0-9,_]+_\./g, '.'));
        }
        // large
        for (const m of text.matchAll(/"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g)) {
          imgs.add(m[1].replace(/\._[A-Z0-9,_]+_\./g, '.'));
        }
      }

      // 2. data-old-hires sur les thumbnails
      document.querySelectorAll('[data-old-hires]').forEach(el => {
        const src = el.getAttribute('data-old-hires');
        if (src && src.includes('m.media-amazon.com')) {
          imgs.add(src.replace(/\._[A-Z0-9,_]+_\./g, '.'));
        }
      });

      // 3. Image principale
      const main = document.querySelector('#landingImage, #main-image, #imgTagWrapperId img');
      if (main) {
        const src = main.getAttribute('data-old-hires') || main.src;
        if (src && src.includes('m.media-amazon.com')) {
          imgs.add(src.replace(/\._[A-Z0-9,_]+_\./g, '.'));
        }
      }

      // 4. Thumbnails galerie
      document.querySelectorAll('#altImages img, .imageThumbnail img').forEach(img => {
        let src = img.getAttribute('data-old-hires') || img.src || '';
        src = src.replace(/\._[A-Z0-9,_]+_\./g, '.');
        if (src.includes('m.media-amazon.com') && src.endsWith('.jpg')) {
          imgs.add(src);
        }
      });

      return [...imgs].filter(u => u.length > 50 && !u.includes('sprite') && !u.includes('transparent'));
    });

    console.log(`  → ${images.length} image(s) brutes trouvées`);
    return images.slice(0, 5);
  } catch (e) {
    console.log(`  → Erreur: ${e.message}`);
    return [];
  }
}

async function run() {
  const { data: cats } = await supabase
    .from('categories').select('id').in('slug', SUBCATS);
  const catIds = cats.map(c => c.id);

  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, slug, image, gallery, specs')
    .in('category_id', catIds)
    .eq('status', 'active');

  console.log(`\n${products.length} produits à traiter\n`);

  // Lancer Playwright
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--lang=fr-FR',
    ]
  });

  const context = await browser.newContext({
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      'Accept-Language': 'fr-FR,fr;q=0.9',
    }
  });

  const page = await context.newPage();
  // Masquer les traces de Playwright
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  let updated = 0, failed = 0, skipped = 0;

  for (const p of products) {
    // Vérifier galerie Amazon déjà OK
    const galSrcs = (p.gallery || []).map(g => typeof g === 'string' ? g : g?.src).filter(Boolean);
    const hasReal = galSrcs.length >= 2 && galSrcs.every(s => s.includes('m.media-amazon.com'));
    if (hasReal) {
      console.log(`✓ ${p.name} — galerie OK (skip)`);
      skipped++;
      continue;
    }

    // Extraire ASIN depuis specs._amazon_url
    const amazonUrl = p.specs?._amazon_url;
    const asin = asinFromUrl(amazonUrl);

    console.log(`\n[${p.slug}]`);
    console.log(`  Produit : ${p.brand} ${p.name}`);
    console.log(`  ASIN    : ${asin || 'non disponible (specs._amazon_url=' + amazonUrl + ')'}`);

    if (!asin) {
      console.log(`  → Pas d'ASIN — skip`);
      failed++;
      continue;
    }

    const imgs = await scrapeAmazonPage(page, asin);

    if (!imgs.length) {
      console.log(`  ✗ Aucune image Amazon — placeholder conservé`);
      failed++;
      await sleep(DELAY);
      continue;
    }

    // 3 images : combler si besoin
    const gallery3 = imgs.slice(0, 3);
    while (gallery3.length < 3) gallery3.push(gallery3[0]);

    const gallery = gallery3.map((src, i) => ({
      src,
      alt: `${p.name} — ${['Vue principale', 'Vue de côté', 'Vue détail'][i]}`
    }));

    const { error } = await supabase.from('products').update({
      image:         gallery3[0],
      main_image_url: gallery3[0],
      gallery,
      gallery_urls:  gallery3,
    }).eq('id', p.id);

    if (error) {
      console.log(`  ✗ DB update: ${error.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${gallery3.length} images sauvegardées:`);
      gallery3.forEach(u => console.log('    •', u.split('/I/')[1]?.slice(0, 25) || u.slice(-35)));
      updated++;
    }

    await sleep(DELAY);
  }

  await browser.close();

  console.log(`\n${'━'.repeat(40)}`);
  console.log(`✅ ${updated} mis à jour | ✓ ${skipped} déjà OK | ❌ ${failed} échecs`);
}

run().catch(e => { console.error(e); process.exit(1); });
