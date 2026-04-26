#!/usr/bin/env node
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');

function loadEnv() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
    raw.split('\n').forEach(l => { const [k, ...v] = l.split('='); if (k && v.length) process.env[k.trim()] = v.join('=').trim(); });
  } catch {}
}
loadEnv();

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PRODUCT = {
  slug: 'hama-kit-nettoyage-pc',
  name: 'Hama Kit Nettoyage PC',
  brand: 'Hama',
  subtitle: 'Kit entretien informatique 5 en 1 — Spray, chiffon, pinceau',
  price_eur: 14.99,
  price_old: 19.99,
  price_kmf: 7375,
  rating: 4,
  rating_count: 3847,
  badge: 'Entretien',
  badge_class: 'badge--popular',
  stock_label: 'En stock',
  description: 'Le kit de nettoyage Hama 5 en 1 est indispensable pour entretenir et prolonger la durée de vie de votre matériel informatique. La poussière accumulée dans les ventilateurs, claviers et ports USB est la première cause de surchauffe et de pannes. Le spray air comprimé expulse la poussière des zones inaccessibles. Le chiffon microfibre non-rayant nettoie l\'écran et la coque. La brosse antistatique protège les composants sensibles lors du nettoyage.',
  features: [
    'Spray air comprimé 400ml — expulse poussière ventilateurs et ports',
    'Chiffon microfibre 30x30cm — nettoyage écran sans rayure',
    'Brosse antistatique — composants internes en sécurité',
    'Stylo nettoyant optique — objectifs et lentilles',
    'Lingettes humides x10 — touches clavier et surfaces',
    'Compatible PC, Mac, tablette, smartphone, console',
    'Garantie 2 ans Hama',
  ],
  specs: {
    'Contenu': 'Spray 400ml + chiffon microfibre + brosse + stylo optique + 10 lingettes',
    'Spray': 'Air comprimé 400ml — propellant HFC',
    'Chiffon': 'Microfibre 30 x 30 cm — non rayant',
    'Brosse': 'Antistatique — sans risque composants',
    'Lingettes': '10 × lingettes humides nettoyantes',
    'Compatibilité': 'PC, Mac, tablette, smartphone, console, appareil photo',
    'Usage recommandé': 'Entretien régulier mensuel, nettoyage avant rangement',
    'Garantie': '2 ans',
  },
  query: 'Hama kit nettoyage informatique PC spray air comprime chiffon microfibre',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function extractImgs(page) {
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
    return [...imgs].filter(u => u.length > 50 && u.includes('/I/')).slice(0, 5);
  });
}

async function run() {
  const { data: cat } = await sb.from('categories').select('id').eq('slug', 'protection').maybeSingle();
  const { data: ex } = await sb.from('products').select('id').eq('slug', PRODUCT.slug).maybeSingle();
  if (ex) { console.log('Doublon — déjà en DB'); return; }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ locale: 'fr-FR', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

  await page.goto('https://www.amazon.fr/s?k=' + encodeURIComponent(PRODUCT.query), { waitUntil: 'domcontentloaded', timeout: 25000 });
  await sleep(1500);
  const link = await page.locator('[data-component-type="s-search-result"] a.a-link-normal[href*="/dp/"]').first().getAttribute('href').catch(() => null);
  const asin = link?.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
  let imgs = [];
  if (asin) {
    const title = await page.locator('[data-component-type="s-search-result"] h2 span').first().textContent().catch(() => '');
    console.log('ASIN:', asin, '|', title.trim().slice(0, 55));
    await sleep(1200);
    await page.goto('https://www.amazon.fr/dp/' + asin, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(2000);
    const tc = await page.locator('#altImages li.item img').count().catch(() => 0);
    for (let i = 0; i < Math.min(tc, 4); i++) { await page.locator('#altImages li.item img').nth(i).click({ force: true }).catch(() => {}); await sleep(300); }
    await sleep(600);
    imgs = await extractImgs(page);
  }
  await browser.close();

  const g3 = imgs.slice(0, 3);
  while (g3.length < 3) g3.push(g3[0] || 'https://placehold.co/600x450/1e3a8a/fff?text=Hama+Kit');
  const gallery = g3.map((src, i) => ({ src, alt: 'Vue ' + (i + 1) }));

  const row = {
    name: PRODUCT.name, slug: PRODUCT.slug, brand: PRODUCT.brand, subtitle: PRODUCT.subtitle,
    description: PRODUCT.description, category_id: cat.id,
    price_eur: PRODUCT.price_eur, price_kmf: PRODUCT.price_kmf, price_old: PRODUCT.price_old,
    rating: PRODUCT.rating, rating_count: PRODUCT.rating_count,
    image: g3[0], main_image_url: g3[0], gallery, gallery_urls: g3,
    features: PRODUCT.features, specs: PRODUCT.specs,
    stock: 20, stock_label: PRODUCT.stock_label,
    badge: PRODUCT.badge, badge_class: PRODUCT.badge_class, status: 'active',
  };
  const { error } = await sb.from('products').insert(row);
  if (error) console.log('✗', error.message);
  else console.log('✓', PRODUCT.name, '+', imgs.length, 'images Amazon');
}
run().catch(console.error);
