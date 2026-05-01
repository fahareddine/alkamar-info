// scripts/playwright-get-cable-images.js
// Utilise Playwright (vrai browser) pour récupérer les vraies images Amazon
// des câbles réseau — contourne le blocage anti-bot

const { chromium } = require('playwright');
const https = require('https');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' },
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location)
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const ct = res.headers['content-type'] || 'image/jpeg';
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buf: Buffer.concat(chunks), ct }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function uploadToStorage(buf, ct, slug, n) {
  const ext = ct.includes('png') ? 'png' : 'jpg';
  const p = `reseau/${slug}-${n}.${ext}`;
  const { error } = await sb.storage.from('products').upload(p, buf, {
    contentType: ct, upsert: true, cacheControl: '31536000',
  });
  if (error) throw error;
  return sb.storage.from('products').getPublicUrl(p).data.publicUrl;
}

// Produits à corriger avec leurs termes de recherche Amazon
const TARGETS = [
  { id: '8501ba29-d1fa-48cc-be3a-46fc12dcb69e', slug: 'cable-cat6-3m',   query: 'câble RJ45 Cat6 3 mètres bleu' },
  { id: '0438f76f-65ec-4d15-ab3d-a9cebe50b9b5', slug: 'cable-cat6-5m',   query: 'câble RJ45 Cat6 5 mètres' },
  { id: '9c8f3554-ddc2-4b74-acc9-0715d5655ccf', slug: 'cable-cat6-plat', query: 'câble réseau plat Cat6 20 mètres' },
  { id: '459aed6c-3472-4676-b06d-767ac0cb3fc1', slug: 'cable-cat6a',     query: 'câble RJ45 Cat6A 10 mètres blindé' },
  { id: 'cb8506e6-6382-4ffd-9377-c004d8a650f9', slug: 'cable-cat8',      query: 'câble RJ45 Cat8 2 mètres' },
  { id: 'c4c6897d-469e-42ea-b0d1-3ab76cf7949c', slug: 'testeur-rj45',    query: 'testeur câble réseau RJ45 RJ11' },
];

async function getAmazonImages(page, query) {
  console.log(`  🔍 "${query}"`);
  const imgs = [];

  // Recherche Amazon.fr
  await page.goto(`https://www.amazon.fr/s?k=${encodeURIComponent(query)}&rh=n%3A430490031`, {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });
  await sleep(2000);

  // Clique sur le 1er résultat avec image
  const results = await page.locator('[data-component-type="s-search-result"] a.a-link-normal.s-no-outline').all();
  if (!results.length) {
    console.log('  ⚠️  Aucun résultat');
    return imgs;
  }

  await results[0].click();
  await page.waitForLoadState('domcontentloaded');
  await sleep(2000);

  // Extrait les images haute résolution de la page produit
  const imageUrls = await page.evaluate(() => {
    const found = new Set();
    // Méthode 1: données JSON intégrées
    const scripts = document.querySelectorAll('script[type="text/javascript"]');
    for (const s of scripts) {
      const matches = s.textContent.matchAll(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g);
      for (const m of matches) found.add(m[1].replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
    }
    // Méthode 2: attributs data-old-hires
    document.querySelectorAll('[data-old-hires]').forEach(el => {
      const u = el.getAttribute('data-old-hires');
      if (u && u.includes('media-amazon')) found.add(u.replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
    });
    // Méthode 3: data-a-dynamic-image
    document.querySelectorAll('[data-a-dynamic-image]').forEach(el => {
      try {
        const data = JSON.parse(el.getAttribute('data-a-dynamic-image'));
        Object.keys(data).forEach(u => {
          if (u.includes('media-amazon')) found.add(u.replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
        });
      } catch {}
    });
    return [...found].filter(u => u.length > 50).slice(0, 5);
  });

  console.log(`  📦 ${imageUrls.length} images trouvées`);
  return imageUrls;
}

async function run() {
  console.log('\n🌐 Playwright Amazon.fr — Récupération vraies images câbles\n' + '═'.repeat(60));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'fr-FR',
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
  });

  const page = await context.newPage();

  // Accepte les cookies Amazon au démarrage
  try {
    await page.goto('https://www.amazon.fr', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);
    const cookieBtn = page.locator('#sp-cc-accept, #a-autoid-0, button[data-action="accept"]').first();
    if (await cookieBtn.isVisible({ timeout: 3000 })) {
      await cookieBtn.click();
      await sleep(1000);
    }
  } catch {}

  const ok = [], fail = [];

  for (const t of TARGETS) {
    console.log(`\n📦 ${t.slug}`);

    let imgs = [];
    let retries = 2;

    while (!imgs.length && retries > 0) {
      imgs = await getAmazonImages(page, t.query);
      if (!imgs.length) { retries--; await sleep(3000); }
    }

    if (!imgs.length) {
      console.log('  ❌ Aucune image');
      fail.push(t.slug);
      continue;
    }

    // Télécharge + uploade exactement 3 images
    const uploaded = [];
    for (let i = 0; i < imgs.length && uploaded.length < 3; i++) {
      try {
        const { buf, ct } = await downloadBuffer(imgs[i]);
        const url = await uploadToStorage(buf, ct, t.slug, uploaded.length + 1);
        uploaded.push(url);
        console.log(`  ✅ img${uploaded.length}: ${url.slice(0, 65)}`);
      } catch(e) {
        console.log(`  ⚠️  ${e.message}`);
      }
    }

    if (!uploaded.length) { fail.push(t.slug); continue; }

    const gallery = uploaded.slice(0, 3);
    const { error } = await sb.from('products').update({
      main_image_url: gallery[0], image: gallery[0],
      gallery_urls: gallery, gallery: gallery,
      updated_at: new Date().toISOString(),
    }).eq('id', t.id);

    if (error) { console.log(`  ❌ DB: ${error.message}`); fail.push(t.slug); }
    else { console.log(`  💾 ${gallery.length} vraies images Amazon sauvegardées`); ok.push(t.slug); }

    await sleep(3000);
  }

  await browser.close();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ OK   (${ok.length}): ${ok.join(', ')}`);
  console.log(`❌ FAIL (${fail.length}): ${fail.join(', ')}`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
