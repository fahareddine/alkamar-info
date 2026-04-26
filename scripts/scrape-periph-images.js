#!/usr/bin/env node
// scripts/scrape-periph-images.js
// Amazon.fr images pour les périphériques via Playwright
// Usage: node scripts/scrape-periph-images.js

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

function loadEnv() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
    raw.split('\n').forEach(l => { const [k,...v]=l.split('='); if(k&&v.length) process.env[k.trim()]=v.join('=').trim(); });
  } catch {}
}
loadEnv();

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SUBCATS = ['clavier','souris','casque','webcam','imprimante','onduleur','essentiel-periph'];

// Requêtes Amazon optimisées par slug
const SEARCH_QUERIES = {
  // Claviers
  'hyperx-alloy-origins-core':    'HyperX Alloy Origins Core clavier mecanique TKL',
  'logitech-k120':                 'Logitech K120 clavier filaire bureautique',
  'keychron-k2-pro':               'Keychron K2 Pro clavier mecanique sans fil',
  'logitech-mk470-combo':          'Logitech MK470 Slim Combo clavier souris sans fil',
  'microsoft-ergonomic-keyboard':  'Microsoft Ergonomic Keyboard clavier ergonomique',
  // Souris
  'logitech-g502-x':               'Logitech G502 X souris gaming filaire',
  'logitech-m185':                 'Logitech M185 souris sans fil compacte',
  'logitech-g-pro-x-superlight2':  'Logitech G Pro X Superlight 2 souris gaming',
  // Casques
  'logitech-h340':                 'Logitech H340 casque USB bureautique',
  'sony-wh-ch720n':                'Sony WH-CH720N casque sans fil antibruit',
  'jabra-evolve2-30':              'Jabra Evolve2 30 casque USB professionnel',
  'logitech-z207':                 'Logitech Z207 enceintes bureau Bluetooth',
  'razer-blackshark-v2-x':         'Razer BlackShark V2 X casque gaming',
  // Webcams
  'logitech-c270':                 'Logitech C270 webcam HD 720p',
  'logitech-c920-hd-pro':          'Logitech C920 HD Pro webcam 1080p',
  'logitech-streamcam':            'Logitech StreamCam webcam 1080p USB-C',
  'razer-kiyo-pro':                'Razer Kiyo Pro webcam streaming 1080p',
  'elgato-facecam-mk2':            'Elgato Facecam MK.2 webcam 1080p 60fps',
  // Imprimantes
  'hp-deskjet-2820e':              'HP DeskJet 2820e imprimante jet encre tout-en-un',
  'canon-pixma-ts3550i':           'Canon PIXMA TS3550i imprimante multifonction',
  'brother-dcp-l2510d':            'Brother DCP-L2510D imprimante laser monochrome',
  'epson-ecotank-et-2851':         'Epson EcoTank ET-2851 imprimante reservoirs rechargeables',
  'hp-laserjet-pro-m404dw':        'HP LaserJet Pro M404dw imprimante laser wifi',
  // Onduleurs
  'apc-back-ups-650va':            'APC Back-UPS 650VA onduleur protection',
  'apc-back-ups-1000va':           'APC Back-UPS 1000VA onduleur',
  'eaton-5e-1100va':               'Eaton 5E 1100VA onduleur',
  'cyberpower-cp1500epfclcd':      'CyberPower CP1500EPFCLCD onduleur LCD',
  'apc-smart-ups-1500va':          'APC Smart-UPS 1500VA onduleur professionnel',
  // Essentiels (à créer)
  'logitech-mk295-combo':          'Logitech MK295 Silent combo clavier souris',
  'logitech-mx-keys-mini':         'Logitech MX Keys Mini clavier sans fil',
  'microsoft-modern-mouse':        'Microsoft Modern Mobile Mouse souris sans fil',
  'trust-ozo-webcam-1080p':        'Trust Ozaa webcam 1080p autofocus',
  'logitech-z200-enceintes':       'Logitech Z200 enceintes bureau stereo',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function extractImages(page) {
  return page.evaluate(() => {
    const imgs = new Set();
    for (const s of document.querySelectorAll('script')) {
      const t = s.textContent || '';
      for (const m of t.matchAll(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
        imgs.add(m[1].replace(/\._[A-Z0-9,_]+_\./g, '.'));
      for (const m of t.matchAll(/"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
        imgs.add(m[1].replace(/\._[A-Z0-9,_]+_\./g, '.'));
    }
    document.querySelectorAll('[data-old-hires]').forEach(el => {
      const s = el.getAttribute('data-old-hires');
      if (s?.includes('m.media-amazon.com')) imgs.add(s.replace(/\._[A-Z0-9,_]+_\./g, '.'));
    });
    const main = document.querySelector('#landingImage, #imgTagWrapperId img');
    if (main) {
      const s = main.getAttribute('data-old-hires') || main.src || '';
      if (s.includes('m.media-amazon.com')) imgs.add(s.replace(/\._[A-Z0-9,_]+_\./g, '.'));
    }
    document.querySelectorAll('#altImages img').forEach(img => {
      let s = img.getAttribute('data-old-hires') || img.src || '';
      s = s.replace(/\._[A-Z0-9,_]+_\./g, '.');
      if (s.includes('m.media-amazon.com') && s.endsWith('.jpg')) imgs.add(s);
    });
    return [...imgs].filter(u => u.length > 50 && !u.includes('sprite') && u.includes('/I/'));
  });
}

async function scrapeProduct(page, slug, query) {
  console.log(`\n[${slug}] "${query}"`);
  try {
    await page.goto(`https://www.amazon.fr/s?k=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(1500);
    const link = await page.locator('[data-component-type="s-search-result"] a.a-link-normal[href*="/dp/"]').first().getAttribute('href').catch(() => null);
    const asin = link?.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
    if (!asin) { console.log('  ✗ Aucun résultat'); return []; }
    const title = await page.locator('[data-component-type="s-search-result"] h2 span').first().textContent().catch(() => '');
    console.log(`  → ASIN: ${asin} | ${title.trim().slice(0, 55)}`);
    await sleep(1200);
    await page.goto(`https://www.amazon.fr/dp/${asin}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(2000);
    // Clic thumbnails pour charger hi-res
    const thumbs = await page.locator('#altImages li.item img').count().catch(() => 0);
    for (let i = 0; i < Math.min(thumbs, 4); i++) {
      await page.locator('#altImages li.item img').nth(i).click({ force: true }).catch(() => {});
      await sleep(300);
    }
    await sleep(600);
    const imgs = await extractImages(page);
    console.log(`  → ${imgs.length} image(s)`);
    return imgs.slice(0, 5);
  } catch (e) {
    console.log(`  ✗ Erreur: ${e.message}`);
    return [];
  }
}

async function run() {
  const { data: cats } = await supabase.from('categories').select('id,slug').in('slug', SUBCATS);
  const catIds = cats?.map(c => c.id) || [];

  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, slug, image, gallery')
    .in('category_id', catIds)
    .eq('status', 'active');

  // Filtrer : seulement ceux sans image Amazon
  const toUpdate = (products || []).filter(p => {
    const galSrcs = (p.gallery || []).map(g => typeof g === 'string' ? g : g?.src).filter(Boolean);
    const hasReal = galSrcs.length >= 2 && galSrcs.every(s => s.includes('m.media-amazon.com'));
    const hasRealImg = p.image?.includes('m.media-amazon.com');
    return !hasReal || !hasRealImg;
  });

  console.log(`${toUpdate.length}/${products?.length || 0} produits à mettre à jour\n`);

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
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

  let updated = 0, failed = 0;

  for (const p of toUpdate) {
    const query = SEARCH_QUERIES[p.slug];
    if (!query) { console.log(`\n⚠ ${p.slug} — pas de query`); continue; }

    const imgs = await scrapeProduct(page, p.slug, query);
    if (!imgs.length) { failed++; await sleep(2000); continue; }

    const g3 = imgs.slice(0, 3);
    while (g3.length < 3) g3.push(g3[0]);
    const gallery = g3.map((src, i) => ({ src, alt: `${p.name} — ${['Vue principale','Vue de côté','Vue détail'][i]}` }));

    const { error } = await supabase.from('products').update({
      image: g3[0], main_image_url: g3[0], gallery, gallery_urls: g3,
    }).eq('id', p.id);

    if (error) { console.log(`  ✗ DB: ${error.message}`); failed++; }
    else { console.log(`  ✓ ${g3.length} images`); updated++; }

    await sleep(2000);
  }

  await browser.close();
  console.log(`\n${'━'.repeat(44)}`);
  console.log(`✅ ${updated} mis à jour | ❌ ${failed} échecs`);
}

run().catch(e => { console.error(e); process.exit(1); });
