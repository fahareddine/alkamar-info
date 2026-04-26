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

const PRODUCTS = [
  {
    slug: 'wd-my-passport-2to',
    name: 'WD My Passport 2To',
    brand: 'Western Digital',
    subtitle: 'Disque dur portable USB-C — Sauvegarde automatique',
    price_eur: 69.99, price_old: 89.99, price_kmf: 34435,
    rating: 4, rating_count: 18743,
    badge: 'Bestseller', badge_class: 'badge--best',
    stock_label: 'En stock',
    description: 'Le WD My Passport 2To est le disque de sauvegarde portable le plus vendu au monde. Compact et léger (130g), il se glisse dans une poche et connecte en USB-C ou USB-A. Le logiciel WD Backup automatise les sauvegardes selon un planning. Chiffrement AES 256 bits avec mot de passe pour protéger vos données confidentielles.',
    features: ['2 To — sauvegarde totale ordinateur et photos', 'USB-C + adaptateur USB-A inclus', 'Chiffrement AES 256 bits + mot de passe', 'WD Backup — sauvegarde automatique planifiée', 'Compatible Time Machine macOS', 'Ultra compact 130g — tient dans la poche', 'Garantie 3 ans WD'],
    specs: { 'Capacité': '2 To (2000 Go)', 'Interface': 'USB 3.0 / USB-C', 'Sécurité': 'AES 256 bits + mot de passe', 'Logiciel': 'WD Backup + WD Discovery', 'Format': '2,5 pouces portable', 'Poids': '130g', 'Compatibilité': 'Windows 10+, macOS 10.15+', 'Usage recommandé': 'Sauvegarde quotidienne, photos, documents', 'Garantie': '3 ans' },
    query: 'WD My Passport 2To disque dur portable USB-C sauvegarde',
  },
  {
    slug: 'brennenstuhl-premium-6-prises',
    name: 'Brennenstuhl Premium-Line',
    brand: 'Brennenstuhl',
    subtitle: 'Multiprise 6 prises parafoudre 60 000A — Câble 3m',
    price_eur: 22.99, price_old: null, price_kmf: 11315,
    rating: 4, rating_count: 9231,
    badge: 'Parafoudre Pro', badge_class: 'badge--popular',
    stock_label: 'En stock',
    description: 'La multiprise Brennenstuhl Premium-Line est la référence professionnelle en protection parasurtension. Sa protection de 60 000 ampères absorbe les plus violentes surtensions dues à la foudre. Câble de 3 mètres pour une installation flexible. Le commutateur illuminé et la protection enfants sur les prises complètent ce produit fiable et durable.',
    features: ['Protection parasurtension 60 000A — protection maximale', '6 prises françaises + 2 prises allemandes', 'Câble 3 mètres — installation flexible', 'Commutateur lumineux on/off', 'Protection enfants intégrée', 'Fixation murale possible', 'Garantie 3 ans Brennenstuhl'],
    specs: { 'Prises': '6 françaises + 2 allemandes (8 total)', 'Protection parasurtension': '60 000 ampères', 'Câble': '3 mètres', 'Commutateur': 'Illuminé marche/arrêt', 'Protection enfants': 'Oui — obturateurs', 'Courant max': '16A / 3680W', 'Usage recommandé': 'Bureau pro, équipements sensibles', 'Garantie': '3 ans' },
    query: 'Brennenstuhl Premium-Line multiprise parafoudre 6 prises 3m',
  },
  {
    slug: 'cooler-master-notepal-x3',
    name: 'Cooler Master NotePal X3',
    brand: 'Cooler Master',
    subtitle: 'Refroidisseur laptop 17 pouces — Ventilateur 200mm silencieux',
    price_eur: 29.99, price_old: 39.99, price_kmf: 14755,
    rating: 4, rating_count: 4156,
    badge: 'Refroidissement', badge_class: 'badge--popular',
    stock_label: 'En stock',
    description: 'Le Cooler Master NotePal X3 protège votre laptop contre la surchauffe — principal ennemi de la durée de vie de votre ordinateur portable. Son ventilateur géant de 200mm tourne lentement tout en déplaçant un grand volume d\'air froid. La surface en mesh aluminium diffuse la chaleur. Compatible laptops jusqu\'à 17 pouces.',
    features: ['Ventilateur 200mm — silencieux et efficace', 'Surface aluminium mesh — diffusion thermique', 'Compatible laptops 15 et 17 pouces', 'Alimentation USB — pas de batterie', 'Angles réglables 3 positions', 'Hub USB x2 intégré', 'Garantie 2 ans Cooler Master'],
    specs: { 'Ventilateur': '200mm — 700 RPM', 'Niveau sonore': '21 dB(A)', 'Compatibilité': 'Laptops jusqu\'à 17 pouces', 'Alimentation': 'USB (câble inclus)', 'Hub USB': '2 ports', 'Angles': '3 positions réglables', 'Usage recommandé': 'Gaming, montage vidéo, usage intensif', 'Garantie': '2 ans' },
    query: 'Cooler Master NotePal refroidisseur laptop 17 pouces ventilateur',
  },
  {
    slug: 'kingston-datatraveler-vault-32go',
    name: 'Kingston DataTraveler Vault 32Go',
    brand: 'Kingston',
    subtitle: 'Clé USB 32Go chiffrée AES 256 bits — Sécurité entreprise',
    price_eur: 54.99, price_old: null, price_kmf: 27055,
    rating: 4, rating_count: 1243,
    badge: 'Chiffré', badge_class: 'badge--exclusive',
    stock_label: 'En stock',
    description: 'La clé USB Kingston DataTraveler Vault est conçue pour transporter des données sensibles en toute sécurité. Son chiffrement matériel AES 256 bits XTS est activé automatiquement. La protection par mot de passe avec verrouillage automatique après 10 tentatives protège contre le brute force. Conforme GDPR pour les entreprises.',
    features: ['Chiffrement AES 256 bits XTS — hardware, pas logiciel', 'Verrouillage auto après 10 tentatives — anti brute force', 'Boîtier aluminium résistant', 'Conforme HIPAA, SOX, GDPR', 'USB 3.0 — transferts rapides', 'Pas de logiciel requis', 'Garantie 5 ans Kingston'],
    specs: { 'Capacité': '32 Go', 'Interface': 'USB 3.0 (USB-A)', 'Chiffrement': 'AES 256 bits XTS (hardware)', 'Protection': 'Mot de passe + verrouillage 10 tentatives', 'Certifications': 'HIPAA, SOX, GDPR', 'Vitesse lecture': '80 Mo/s', 'Vitesse écriture': '20 Mo/s', 'Usage recommandé': 'Données sensibles, entreprise, terrain', 'Garantie': '5 ans' },
    query: 'Kingston DataTraveler Vault Privacy cle USB chiffree AES 256',
  },
  {
    slug: 'kensington-smartfit-stand',
    name: 'Kensington SmartFit Easy Riser',
    brand: 'Kensington',
    subtitle: 'Support laptop ergonomique — 6 hauteurs réglables',
    price_eur: 27.99, price_old: 34.99, price_kmf: 13775,
    rating: 4, rating_count: 5678,
    badge: 'Ergonomique', badge_class: 'badge--popular',
    stock_label: 'En stock',
    description: 'Le support Kensington SmartFit Easy Riser améliore la posture et protège votre laptop en l\'élevant à hauteur des yeux. La surface perforée permet une circulation d\'air optimale pour refroidir le laptop. Compatible avec tous les laptops de 10 à 17 pouces. Léger et pliable pour transport facile.',
    features: ['6 hauteurs réglables — adaptez à votre posture', 'Surface perforée — refroidissement laptop amélioré', 'Compatible 10 à 17 pouces', 'Léger 340g — pliable pour le transport', 'Antidérapant — laptop stable', 'Système SmartFit couleur par hauteur', 'Garantie 2 ans Kensington'],
    specs: { 'Compatibilité': 'Laptops 10 à 17 pouces', 'Hauteurs': '6 positions réglables', 'Surface': 'Perforée — ventilation optimale', 'Poids': '340g', 'Charge max': '5 kg', 'Transport': 'Pliable compact', 'Usage recommandé': 'Home office, bureau, posture', 'Garantie': '2 ans' },
    query: 'Kensington SmartFit Easy Riser support laptop ergonomique',
  },
];

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
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ locale: 'fr-FR', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

  let ok = 0;
  for (const p of PRODUCTS) {
    console.log('\n[' + p.slug + ']');
    const { data: ex } = await sb.from('products').select('id').eq('slug', p.slug).maybeSingle();
    if (ex) { console.log('  ↩ Doublon'); continue; }

    await page.goto('https://www.amazon.fr/s?k=' + encodeURIComponent(p.query), { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(1500);
    const link = await page.locator('[data-component-type="s-search-result"] a.a-link-normal[href*="/dp/"]').first().getAttribute('href').catch(() => null);
    const asin = link?.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
    let imgs = [];
    if (asin) {
      const title = await page.locator('[data-component-type="s-search-result"] h2 span').first().textContent().catch(() => '');
      console.log('  ASIN:', asin, '|', title.trim().slice(0, 50));
      await sleep(1200);
      await page.goto('https://www.amazon.fr/dp/' + asin, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(2000);
      const tc = await page.locator('#altImages li.item img').count().catch(() => 0);
      for (let i = 0; i < Math.min(tc, 4); i++) { await page.locator('#altImages li.item img').nth(i).click({ force: true }).catch(() => {}); await sleep(300); }
      await sleep(600);
      imgs = await extractImgs(page);
    }

    const g3 = imgs.slice(0, 3);
    while (g3.length < 3) g3.push(g3[0] || 'https://placehold.co/600x450/1e3a8a/fff?text=' + encodeURIComponent(p.name));
    const gallery = g3.map((src, i) => ({ src, alt: 'Vue ' + (i + 1) }));

    const row = {
      name: p.name, slug: p.slug, brand: p.brand, subtitle: p.subtitle,
      description: p.description, category_id: cat.id,
      price_eur: p.price_eur, price_kmf: p.price_kmf, price_old: p.price_old || null,
      rating: p.rating, rating_count: p.rating_count,
      image: g3[0], main_image_url: g3[0], gallery, gallery_urls: g3,
      features: p.features, specs: p.specs,
      stock: 15, stock_label: p.stock_label,
      badge: p.badge, badge_class: p.badge_class, status: 'active',
    };
    const { error } = await sb.from('products').insert(row);
    if (error) console.log('  ✗', error.message);
    else { console.log('  ✓ importé +', imgs.length, 'images'); ok++; }
    await sleep(2000);
  }
  await browser.close();
  console.log('\n✅', ok, '/ 5 importés');
}
run().catch(console.error);
