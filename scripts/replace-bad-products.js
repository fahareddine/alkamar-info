// scripts/replace-bad-products.js
// Remplace les produits sans images propres par des équivalents avec vraies photos

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

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
      },
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return fetchHtml(loc).then(resolve).catch(reject);
      }
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ s: res.statusCode, b: d }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'Accept': 'image/*,*/*' },
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location)
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const ct = res.headers['content-type'] || 'image/jpeg';
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buf: Buffer.concat(chunks), ct }));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function uploadToStorage(buf, ct, slug, n) {
  const ext = ct.includes('png') ? 'png' : 'jpg';
  const p = `reseau/${slug}-${n}.${ext}`;
  const { error } = await sb.storage.from('products').upload(p, buf, { contentType: ct, upsert: true, cacheControl: '31536000' });
  if (error) throw error;
  return sb.storage.from('products').getPublicUrl(p).data.publicUrl;
}

function extractTpLink(html) {
  const s = new Set();
  for (const m of html.matchAll(/https:\/\/static\.tp-link\.com\/[^\s"'<>]+\.(?:jpg|png)/gi))
    if (!m[0].includes('icon') && !m[0].includes('logo') && !m[0].includes('banner') && m[0].length > 50) s.add(m[0]);
  return [...s];
}

function extractUbiquiti(html) {
  const s = new Set();
  for (const m of html.matchAll(/https:\/\/cdn\.ecomm\.ui\.com\/products\/[^\s"'<>]+\.(?:png|jpg|webp)/gi)) s.add(m[0]);
  return [...s];
}

function extractOg(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m?.[1]?.startsWith('http') && !m[1].includes('.svg') && !m[1].includes('logo') ? m[1] : null;
}

async function fetchAndUpload(pageUrl, extractor, slug, limit = 3) {
  const { s, b } = await fetchHtml(pageUrl);
  if (s !== 200) throw new Error(`HTTP ${s}`);

  let candidates = extractor(b);
  const og = extractOg(b);
  if (og && !candidates.includes(og)) candidates.unshift(og);
  candidates = [...new Set(candidates)].slice(0, limit * 3);

  console.log(`  📄 Page: ${candidates.length} candidats`);

  const uploaded = [];
  for (const url of candidates) {
    if (uploaded.length >= limit) break;
    try {
      const { buf, ct } = await downloadBuffer(url);
      const pubUrl = await uploadToStorage(buf, ct, slug, uploaded.length + 1);
      uploaded.push(pubUrl);
      console.log(`  ✅ img${uploaded.length}: ${pubUrl.slice(0, 65)}`);
    } catch(e) { console.log(`  ⚠️  skip: ${e.message}`); }
    await sleep(200);
  }
  return uploaded;
}

// ── Remplacements ─────────────────────────────────────────────────────────────
const REPLACEMENTS = [

  // ── ASUS RT-AX56U → TP-Link Archer AX21 (WiFi 6 AX1800) ──
  {
    id: '0cee144e-22d7-4c60-a5bf-f2a150487db8',
    slug: 'tp-link-archer-ax21',
    page: 'https://www.tp-link.com/en/home-networking/wifi-router/archer-ax21/',
    extractor: extractTpLink,
    update: {
      name       : 'TP-Link Archer AX21 WiFi 6',
      subtitle   : 'WiFi 6 AX1800 · 4P Gigabit · OFDMA',
      brand      : 'TP-Link',
      price_eur  : 54.99,
      price_kmf  : Math.round(54.99 * 492),
      badge      : 'WiFi 6', badge_class: 'badge--popular',
      rating     : 4, rating_count: 2876,
      description: 'Le TP-Link Archer AX21 est un routeur WiFi 6 AX1800 double bande idéal pour la maison. Avec ses 4 ports Gigabit et la technologie OFDMA, il gère efficacement plusieurs appareils simultanément. Simple à configurer via l\'application Tether.',
      features   : ['WiFi 6 AX1800 — double bande 2.4 + 5 GHz','4 ports Gigabit LAN','OFDMA + MU-MIMO simultané','WPA3 — sécurité renforcée','Configuration rapide via Tether App'],
      specs      : { 'Standard': 'WiFi 6 (802.11ax)', 'Vitesse': 'AX1800 (1800 Mbps)', 'Bandes': 'Dual Band', 'Ports LAN': '4 × Gigabit', 'WAN': '1 × Gigabit', 'Sécurité': 'WPA3', 'Antennes': '4 externes' },
    },
  },

  // ── ASUS EBP68 → Ubiquiti UniFi U6 Pro ──
  {
    id: '691f966c-d11e-427c-8ce6-6438cd74473f',
    slug: 'ubiquiti-u6-pro',
    page: 'https://store.ui.com/us/en/products/u6-pro',
    extractor: extractUbiquiti,
    update: {
      name       : 'Ubiquiti UniFi U6 Pro',
      subtitle   : 'WiFi 6 4×4 · PoE 802.3at · 300 m²',
      brand      : 'Ubiquiti',
      price_eur  : 179,
      price_kmf  : Math.round(179 * 492),
      badge      : 'Pro', badge_class: 'badge--exclusive',
      rating     : 5, rating_count: 891,
      description: 'Le Ubiquiti UniFi U6 Pro est un point d\'accès WiFi 6 professionnel 4×4 MU-MIMO. Idéal pour les entreprises et bureaux, il offre une couverture WiFi 6 jusqu\'à 300 m² avec une gestion centralisée via UniFi Network. Alimentation PoE 802.3at.',
      features   : ['WiFi 6 AX5300 4×4 MU-MIMO','PoE 802.3at — sans prise secteur','Couverture jusqu\'à 300 m²','300+ appareils simultanés','Gestion centralisée UniFi Network'],
      specs      : { 'Standard': 'WiFi 6 (802.11ax)', 'Vitesse': 'AX5300', 'MU-MIMO': '4×4', 'PoE': '802.3at (22W)', 'Couverture': '300 m²', 'Appareils': '300+', 'Gestion': 'UniFi Network', 'Montage': 'Plafond' },
    },
  },

  // ── TP-Link RE330 → TP-Link RE550 (WiFi 5 AC1900) ──
  {
    id: 'd71b057b-afa0-4e78-859b-679dcbe95194',
    slug: 'tp-link-re550',
    page: 'https://www.tp-link.com/en/home-networking/range-extender/re550/',
    extractor: extractTpLink,
    update: {
      name       : 'TP-Link RE550 Répéteur WiFi 5',
      subtitle   : 'WiFi 5 AC1900 · Gigabit · MU-MIMO',
      brand      : 'TP-Link',
      price_eur  : 49.99,
      price_kmf  : Math.round(49.99 * 492),
      badge      : 'Populaire', badge_class: 'badge--popular',
      rating     : 4, rating_count: 3241,
      description: 'Le TP-Link RE550 est un répéteur WiFi 5 AC1900 haute performance. Il double la couverture de votre réseau WiFi avec un débit jusqu\'à 1900 Mbps et un port Ethernet Gigabit. Compatible avec tous les routeurs, il s\'installe en 1 minute via WPS.',
      features   : ['WiFi 5 AC1900 — jusqu\'à 1900 Mbps','Port Ethernet Gigabit intégré','MU-MIMO — connexions simultanées','Signal LED indicateur optimal','Compatible tous routeurs WiFi'],
      specs      : { 'Standard': 'WiFi 5 AC1900', 'Bandes': '2.4 GHz + 5 GHz', 'Débit': '600 + 1300 Mbps', 'Port LAN': '1 × Gigabit', 'Antennes': '3 externes', 'Sécurité': 'WPA2/WPA3', 'WPS': 'Oui' },
    },
  },
];

// ── Câbles : essai Hama (redirect suivi) + logilink ──────────────────────────
const CABLE_SOURCES = [
  { name: 'Hama-cat5e', url: 'https://www.hama.com/en/gb/00200850/hama-network-cable-cat5e-utp-10m' },
  { name: 'Hama-cat6a', url: 'https://www.hama.com/en/gb/00200915/hama-network-cable-cat6a-utp-10m' },
  { name: 'Hama-cat8',  url: 'https://www.hama.com/en/gb/00305960/hama-cat-8-network-cable-2m' },
  { name: 'LogiLink-cat6',  url: 'https://www.logilink.de/Products/Networking-Infrastructure/Patch-Cords-RJ45/Cat6-Patch-cords-RJ45/Cat6-Patch-cord-U-UTP-booted-3-00m-blue_CP003U' },
  { name: 'LogiLink-cat8',  url: 'https://www.logilink.de/Products/Networking-Infrastructure/Patch-Cords-RJ45/Cat8-Patch-cords-RJ45/Cat8-Patch-cord-S-FTP-booted-0-50m-black_CQ0030S' },
];

async function run() {
  console.log(`\n🔄 Remplacement ${REPLACEMENTS.length} produits + recherche câbles\n${'═'.repeat(60)}`);
  const ok = [], fail = [];

  // Phase 1 : remplacements produits
  for (const r of REPLACEMENTS) {
    console.log(`\n📦 ${r.update.name}`);
    let imgs = [];

    try {
      imgs = await fetchAndUpload(r.page, r.extractor, r.slug, 3);
    } catch(e) {
      console.log(`  ❌ Fetch échoué: ${e.message}`);
    }

    if (!imgs.length) { fail.push(r.update.name); continue; }

    const update = {
      ...r.update,
      main_image_url: imgs[0],
      image         : imgs[0],
      gallery_urls  : imgs,
      gallery       : imgs,
      slug          : r.slug,
      stock         : 8,
      stock_label   : 'En stock',
      updated_at    : new Date().toISOString(),
    };
    const { error } = await sb.from('products').update(update).eq('id', r.id);
    if (error) { console.log(`  ❌ DB: ${error.message}`); fail.push(r.update.name); }
    else { console.log(`  💾 Remplacé avec ${imgs.length} vraies images`); ok.push(r.update.name); }

    await sleep(2000);
  }

  // Phase 2 : sources câbles
  console.log('\n\n🔌 Recherche images câbles...');
  for (const src of CABLE_SOURCES) {
    try {
      const { s, b } = await fetchHtml(src.url);
      const all = new Set();
      for (const m of b.matchAll(/https:\/\/(?:assets|cdn|www)\.(?:hama|logilink)\.(?:com|de|co\.uk)[^\s"'<>]+\.(?:jpg|png|webp)/gi))
        if (!m[0].includes('icon') && !m[0].includes('logo')) all.add(m[0]);
      const og = extractOg(b);
      if (og) all.add(og);
      console.log(`  ${src.name} [${s}]: ${all.size} imgs${og ? ' og='+og.slice(0,60) : ''}`);
    } catch(e) { console.log(`  ${src.name} ERR: ${e.message}`); }
    await sleep(500);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ Remplacés (${ok.length}): ${ok.join(', ')}`);
  console.log(`❌ Échec     (${fail.length}): ${fail.join(', ')}`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
