// scripts/fix-3images-reseau.js
// Trouve 3 images réelles par produit réseau — toutes sources
const https  = require('https');
const http   = require('http');
const path   = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function fetchHtml(url, ua) {
  return new Promise((resolve, reject) => {
    try {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, {
        headers: {
          'User-Agent': ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Encoding': 'identity',
        },
      }, res => {
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
          const loc = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
          return fetchHtml(loc, ua).then(resolve).catch(reject);
        }
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ s: res.statusCode, b: d }));
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    } catch(e) { reject(e); }
  });
}

function headUrl(url) {
  return new Promise(resolve => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' }, timeout: 6000 }, res => {
        resolve({ ok: res.statusCode < 400, status: res.statusCode, ct: res.headers['content-type'] || '' });
      });
      req.on('error', () => resolve({ ok: false, status: 0, ct: '' }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, ct: '' }); });
      req.end();
    } catch { resolve({ ok: false, status: 0, ct: '' }); }
  });
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    try {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'Accept': 'image/*' },
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
    } catch(e) { reject(e); }
  });
}

async function uploadToStorage(buf, ct, storagePath) {
  const { error } = await sb.storage.from('products').upload(storagePath, buf, { contentType: ct, upsert: true, cacheControl: '31536000' });
  if (error) throw error;
  return sb.storage.from('products').getPublicUrl(storagePath).data.publicUrl;
}

// ── Extractors ───────────────────────────────────────────────────────────────
function extractAmz(html) {
  const s = new Set();
  for (const m of html.matchAll(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
    s.add(m[1].replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
  for (const m of html.matchAll(/"large":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
    s.add(m[1].replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
  return [...s].filter(u => u.length > 50);
}

function extractTpLink(html) {
  const s = new Set();
  for (const m of html.matchAll(/https:\/\/static\.tp-link\.com\/[^\s"'<>]+\.(?:jpg|png)/gi))
    if (!m[0].includes('icon') && !m[0].includes('logo') && !m[0].includes('banner')) s.add(m[0]);
  return [...s];
}

function extractOg(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return (m?.[1] && m[1].startsWith('http') && !m[1].includes('.svg') && !m[1].includes('logo')) ? m[1] : null;
}

function extractAllImages(html, baseUrl) {
  const s = new Set();
  const og = extractOg(html);
  if (og) s.add(og);
  for (const u of extractTpLink(html)) s.add(u);
  for (const u of extractAmz(html)) s.add(u);
  // ASUS CDN
  for (const m of html.matchAll(/https:\/\/(?:dlcdnimgs?|www)\.asus\.com\/[^\s"'<>]+\.(?:jpg|png|webp)/gi))
    if (!m[0].includes('icon') && !m[0].includes('logo')) s.add(m[0]);
  return [...s].filter(u => u.length > 30);
}

// ── Télécharge + upload N images ─────────────────────────────────────────────
async function downloadAndUpload(imageUrls, slug, n = 3) {
  const uploaded = [];
  for (let i = 0; i < imageUrls.length && uploaded.length < n; i++) {
    try {
      const { buf, ct } = await downloadBuffer(imageUrls[i]);
      const ext = ct.includes('png') ? 'png' : 'jpg';
      const url  = await uploadToStorage(buf, ct, `reseau/${slug}-${uploaded.length + 1}.${ext}`);
      uploaded.push(url);
      console.log(`    ⬆️  img${uploaded.length}: ${url.slice(0, 65)}`);
    } catch(e) {
      console.log(`    ⚠️  skip ${imageUrls[i].slice(0, 50)}: ${e.message}`);
    }
    await sleep(300);
  }
  return uploaded;
}

// ── Sources par produit ──────────────────────────────────────────────────────
const TARGETS = [
  // ASUS RT-AX56U
  { id: '0cee144e-22d7-4c60-a5bf-f2a150487db8', name: 'ASUS RT-AX56U', slug: 'asus-rt-ax56u',
    sources: [
      { type: 'page', url: 'https://www.asus.com/networking-iot-servers/for-home/all-series/rt-ax56u/' },
      { type: 'page', url: 'https://www.asus.com/fr/networking-iot-servers/for-home/all-series/rt-ax56u/' },
      { type: 'amz', asin: 'B082VJ4JN5' },
    ]
  },

  // ASUS ExpertWiFi EBP68
  { id: '691f966c-d11e-427c-8ce6-6438cd74473f', name: 'ASUS EBP68', slug: 'asus-ebp68',
    sources: [
      { type: 'page', url: 'https://www.asus.com/networking-iot-servers/for-home/all-series/asus-expertwifi-ebp68/' },
      { type: 'page', url: 'https://www.asus.com/fr/networking-iot-servers/for-home/all-series/asus-expertwifi-ebp68/' },
      { type: 'amz', asin: 'B0CZW8HDWW' },
    ]
  },

  // TP-Link RE330
  { id: 'd71b057b-afa0-4e78-859b-679dcbe95194', name: 'TP-Link RE330', slug: 'tp-link-re330',
    sources: [
      { type: 'page', url: 'https://www.tp-link.com/en/home-networking/range-extender/re330/' },
      { type: 'page', url: 'https://www.tp-link.com/en/home-networking/range-extender/re330/v1/' },
      { type: 'amz', asin: 'B09BFXNLH9' },
    ]
  },

  // Câble RJ45 Cat6 3m
  { id: '8501ba29-d1fa-48cc-be3a-46fc12dcb69e', name: 'Câble Cat6 3m', slug: 'cable-rj45-cat6-3m',
    sources: [
      { type: 'amz', asin: 'B01CQMXD0S' },
      { type: 'amz', asin: 'B00AKJXN76' },
      { type: 'amz', asin: 'B00L2JQPBQ' },
      { type: 'page', url: 'https://www.tp-link.com/en/home-networking/accessory/tl-ec540-3m/' },
    ]
  },

  // Câble RJ45 Cat6 5m
  { id: '0438f76f-65ec-4d15-ab3d-a9cebe50b9b5', name: 'Câble Cat6 5m', slug: 'cable-rj45-cat6-5m',
    sources: [
      { type: 'amz', asin: 'B01CQMXD1G' },
      { type: 'amz', asin: 'B00L2JQL4A' },
      { type: 'amz', asin: 'B00NRC4RZS' },
    ]
  },

  // Câble RJ45 Cat6 Plat 20m
  { id: '9c8f3554-ddc2-4b74-acc9-0715d5655ccf', name: 'Câble Cat6 Plat 20m', slug: 'cable-rj45-cat6-plat-20m',
    sources: [
      { type: 'amz', asin: 'B01M8LKUF4' },
      { type: 'amz', asin: 'B00NMXX84S' },
      { type: 'amz', asin: 'B01N5OZMQG' },
    ]
  },

  // Câble RJ45 Cat6A 10m
  { id: '459aed6c-3472-4676-b06d-767ac0cb3fc1', name: 'Câble Cat6A 10m', slug: 'cable-rj45-cat6a-10m',
    sources: [
      { type: 'amz', asin: 'B01N5OZMQG' },
      { type: 'amz', asin: 'B07R2GFZN4' },
      { type: 'amz', asin: 'B07GVYTG19' },
    ]
  },

  // Câble RJ45 Cat8 2m
  { id: 'cb8506e6-6382-4ffd-9377-c004d8a650f9', name: 'Câble Cat8 2m', slug: 'cable-rj45-cat8-2m',
    sources: [
      { type: 'amz', asin: 'B07VC2VRWF' },
      { type: 'amz', asin: 'B08TTVTQMD' },
      { type: 'amz', asin: 'B082QHK7T7' },
    ]
  },

  // Testeur Câble RJ45
  { id: 'c4c6897d-469e-42ea-b0d1-3ab76cf7949c', name: 'Testeur Câble RJ45', slug: 'testeur-cable-rj45',
    sources: [
      { type: 'amz', asin: 'B01N1U2KZ2' },
      { type: 'amz', asin: 'B083G8H5KS' },
      { type: 'amz', asin: 'B01CF3TQAY' },
    ]
  },
];

async function processTarget(t) {
  console.log(`\n📦 ${t.name}`);
  let candidates = [];

  for (const src of t.sources) {
    if (candidates.length >= 6) break;
    try {
      if (src.type === 'amz') {
        // Try Amazon.fr
        const { s, b } = await fetchHtml(`https://www.amazon.fr/dp/${src.asin}`);
        if (s === 200) {
          const imgs = extractAmz(b);
          if (imgs.length) { console.log(`  ✅ Amazon.fr ASIN ${src.asin}: ${imgs.length} imgs`); for (const i of imgs) candidates.push(i); }
          else {
            // Try Amazon.com
            const { s: s2, b: b2 } = await fetchHtml(`https://www.amazon.com/dp/${src.asin}`);
            if (s2 === 200) { const imgs2 = extractAmz(b2); if (imgs2.length) { console.log(`  ✅ Amazon.com ASIN ${src.asin}: ${imgs2.length} imgs`); for (const i of imgs2) candidates.push(i); } }
          }
        }
      } else if (src.type === 'page') {
        const { s, b } = await fetchHtml(src.url);
        if (s === 200) {
          const imgs = extractAllImages(b, src.url);
          if (imgs.length) { console.log(`  ✅ Page ${src.url.replace(/https?:\/\//,'').slice(0,50)}: ${imgs.length} imgs`); for (const i of imgs) candidates.push(i); }
        } else {
          console.log(`  ⚠️  ${src.url.slice(-40)}: ${s}`);
        }
      }
    } catch(e) { console.log(`  ❌ ${e.message}`); }
    await sleep(2500);
  }

  // Dédupliquer
  candidates = [...new Set(candidates)].slice(0, 9);

  if (!candidates.length) {
    console.log('  ❌ Aucune image trouvée');
    return null;
  }

  console.log(`  → ${candidates.length} candidats, téléchargement 3...`);

  // Vérifie accessibilité des candidats et prend les 3 premiers accessibles
  const valid = [];
  for (const u of candidates) {
    if (valid.length >= 6) break; // buffer pour upload
    const h = await headUrl(u);
    if (h.ok && (h.ct.includes('image') || h.ct.includes('jpeg') || h.ct.includes('png') || h.ct.includes('webp') || !h.ct)) valid.push(u);
    await sleep(100);
  }

  if (!valid.length) {
    console.log('  ❌ Toutes les images sont inaccessibles');
    return null;
  }

  // Upload exactement 3 dans Supabase Storage
  const uploaded = await downloadAndUpload(valid, t.slug, 3);
  return uploaded.length >= 1 ? uploaded : null;
}

async function run() {
  console.log(`\n🔧 Fix 3 images réelles — ${TARGETS.length} produits\n${'═'.repeat(60)}`);
  const ok = [], fail = [];

  for (const t of TARGETS) {
    const imgs = await processTarget(t);

    if (!imgs || !imgs.length) {
      fail.push(t.name);
      continue;
    }

    // Garde exactement 3 images (ou moins si < 3 uploadées)
    const gallery = imgs.slice(0, 3);
    const { error } = await sb.from('products').update({
      main_image_url: gallery[0],
      image         : gallery[0],
      gallery_urls  : gallery,
      gallery       : gallery,
      updated_at    : new Date().toISOString(),
    }).eq('id', t.id);

    if (error) {
      console.log(`  ❌ DB: ${error.message}`);
      fail.push(t.name);
    } else {
      console.log(`  💾 ${gallery.length} image(s) sauvegardées`);
      ok.push(t.name + ' (' + gallery.length + ')');
    }

    await sleep(1000);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ OK    (${ok.length}): ${ok.join(', ')}`);
  console.log(`❌ FAIL  (${fail.length}): ${fail.join(', ')}`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
