// scripts/fix-reseau-final.js — Correction finale images réseau
// Stratégie : Amazon retry → Supabase Storage upload
const https  = require('https');
const path   = require('path');
const { createReadStream, createWriteStream, mkdirSync, unlinkSync } = require('fs');
const os     = require('os');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'identity',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
      },
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return fetchHtml(loc).then(resolve).catch(reject);
      }
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'Accept': 'image/*' },
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location)
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'image/jpeg' }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── Amazon images extractor ───────────────────────────────────────────────────
function extractAmazonImages(html) {
  const imgs = new Set();
  for (const m of html.matchAll(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
    imgs.add(m[1].replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
  for (const m of html.matchAll(/"large":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
    imgs.add(m[1].replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
  return [...imgs].filter(u => u.length > 50).slice(0, 5);
}

// ── Supabase Storage upload ──────────────────────────────────────────────────
async function uploadToStorage(imageUrl, storagePath) {
  try {
    const { buffer, contentType } = await downloadBuffer(imageUrl);
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const fullPath = `${storagePath}.${ext}`;
    const { error } = await sb.storage.from('products').upload(fullPath, buffer, {
      contentType, upsert: true, cacheControl: '31536000',
    });
    if (error) throw error;
    const { data } = sb.storage.from('products').getPublicUrl(fullPath);
    return data.publicUrl;
  } catch(e) {
    throw new Error(`Upload failed: ${e.message}`);
  }
}

// ── Manufacturer OG image extractor ──────────────────────────────────────────
function extractOg(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m?.[1]?.startsWith('http') && !m[1].includes('.svg') && !m[1].includes('logo') ? m[1] : null;
}
function extractTpImages(html) {
  const imgs = new Set();
  for (const m of html.matchAll(/https:\/\/static\.tp-link\.com\/[^\s"'<>]+\.(?:jpg|png)/gi))
    if (!m[0].includes('icon') && !m[0].includes('logo')) imgs.add(m[0]);
  return [...imgs];
}

// ── Targets ──────────────────────────────────────────────────────────────────
const TARGETS = [
  // 4G Routers
  { id: '984f3678-854c-49fd-bfa0-c7f19b628ffa', name: 'TP-Link MR6400',     slug: 'tl-mr6400',
    amazon_asins: ['B09PVH9G4P','B07BM9H698','B09VP1RY44'],
    mfg_urls: ['https://www.tp-link.com/en/home-networking/4g-router/tl-mr6400/'] },

  { id: 'c347cf83-7ead-4abe-a952-c578e6527963', name: 'TP-Link MR100',      slug: 'tl-mr100',
    amazon_asins: ['B07MTJFKQ6','B08J11BRF6'],
    mfg_urls: ['https://www.tp-link.com/en/home-networking/4g-router/tl-mr100/'] },

  // Access Points
  { id: '4dfa2513-8234-4502-99df-e3349bbd23e0', name: 'TP-Link EAP225',     slug: 'eap225',
    amazon_asins: ['B07B6JFMNR','B09BG7RRZS'],
    mfg_urls: ['https://www.tp-link.com/en/business-networking/ceiling-mount-eap/eap225/'] },

  { id: '6e3bc102-313f-497c-8162-711681b6cabe', name: 'TP-Link EAP670',     slug: 'eap670',
    amazon_asins: ['B09BG7RRZS','B0CBXQGQHP'],
    mfg_urls: ['https://www.tp-link.com/en/business-networking/ceiling-mount-eap/eap670/'] },

  // Switches
  { id: 'eb670eec-8ffb-4aeb-a38b-994620908a46', name: 'TP-Link TL-SG116E',  slug: 'tl-sg116e',
    amazon_asins: ['B097B65CK8','B01MDPPPF7'],
    mfg_urls: ['https://www.tp-link.com/en/business-networking/smart-switch/tl-sg116e/'] },

  { id: 'dfa7a00f-135a-4257-9686-99a343851abf', name: 'Cisco SG350-10',     slug: 'cisco-sg350-10',
    amazon_asins: ['B004D64T3A','B0752QXLY2'] },

  { id: 'cd68bb52-4b21-425a-b51f-d7469f0e23c4', name: 'Netgear GS308',      slug: 'netgear-gs308',
    amazon_asins: ['B07HGL9WXY','B00M1C034K'] },

  { id: '7a465d4a-d188-414d-bbae-1d06e5b5f453', name: 'Netgear WAX214',     slug: 'netgear-wax214',
    amazon_asins: ['B09DNG89JB','B09WC11CPP'],
    mfg_urls: ['https://www.netgear.com/business/wifi/access-points/wax214/'] },

  // Cables
  { id: '9c8f3554-ddc2-4b74-acc9-0715d5655ccf', name: 'Câble RJ45 Cat6 Plat 20m', slug: 'cable-cat6-plat-20m',
    amazon_asins: ['B00NRC4RZS','B09CGLVXNW','B01M8LKUF4'] },

  { id: '459aed6c-3472-4676-b06d-767ac0cb3fc1', name: 'Câble RJ45 Cat6A 10m', slug: 'cable-cat6a-10m',
    amazon_asins: ['B01N5OZMQG','B07R2GFZN4','B07GVYTG19'] },

  { id: 'cb8506e6-6382-4ffd-9377-c004d8a650f9', name: 'Câble RJ45 Cat8 2m',   slug: 'cable-cat8-2m',
    amazon_asins: ['B07VC2VRWF','B08TTVTQMD','B082QHK7T7'] },

  { id: 'c4c6897d-469e-42ea-b0d1-3ab76cf7949c', name: 'Testeur câble RJ45',   slug: 'testeur-rj45',
    amazon_asins: ['B01N1U2KZ2','B083G8H5KS','B01CF3TQAY'] },

  { id: '0438f76f-65ec-4d15-ab3d-a9cebe50b9b5', name: 'Câble Cat6 5m',        slug: 'cable-cat6-5m',
    amazon_asins: ['B01CQMXD1G','B09CGLVXNW'] },

  { id: '8501ba29-d1fa-48cc-be3a-46fc12dcb69e', name: 'Câble Cat6 3m',        slug: 'cable-cat6-3m',
    amazon_asins: ['B01CQMXD0S','B09CGLY4FY'] },
];

async function processTarget(t) {
  console.log(`\n📦 ${t.name}`);

  // 1. Try Amazon
  for (const asin of (t.amazon_asins || [])) {
    try {
      const { status, body } = await fetchHtml(`https://www.amazon.fr/dp/${asin}`);
      if (status === 200) {
        const imgs = extractAmazonImages(body);
        if (imgs.length) {
          console.log(`  ✅ Amazon ASIN ${asin}: ${imgs.length} images`);
          return { imgs, source: 'amazon' };
        }
      }
    } catch {}
    await sleep(2000);
  }

  // 2. Try manufacturer
  for (const url of (t.mfg_urls || [])) {
    try {
      const { status, body } = await fetchHtml(url);
      if (status === 200) {
        const og = extractOg(body);
        const tpImgs = extractTpImages(body);
        const all = [...tpImgs];
        if (og && !all.includes(og)) all.unshift(og);
        if (all.length) {
          console.log(`  ✅ Fabricant: ${all.length} images`);
          return { imgs: all.slice(0, 5), source: 'manufacturer' };
        }
      }
    } catch {}
    await sleep(500);
  }

  // 3. Upload vers Supabase Storage via première image accessible
  console.log(`  ⬆️  Tentative Supabase Storage...`);
  for (const asin of (t.amazon_asins || [])) {
    const searchUrl = `https://www.amazon.fr/s?k=${encodeURIComponent(t.name.replace(' ', '+'))}`;
    // Try first image from known ASIN product page (Amazon.com US)
    try {
      const { status, body } = await fetchHtml(`https://www.amazon.com/dp/${asin}`);
      if (status === 200) {
        const imgs = extractAmazonImages(body);
        if (imgs.length) {
          // Download and upload to Supabase
          const publicUrl = await uploadToStorage(imgs[0], `reseau/${t.slug}-1`);
          console.log(`  ✅ Supabase Storage: ${publicUrl}`);
          const allUrls = [publicUrl];
          // Try to upload more
          for (let i = 1; i < Math.min(imgs.length, 3); i++) {
            try {
              const url2 = await uploadToStorage(imgs[i], `reseau/${t.slug}-${i+1}`);
              allUrls.push(url2);
            } catch {}
          }
          return { imgs: allUrls, source: 'supabase-amazon-us' };
        }
      }
    } catch(e) {}
    await sleep(2000);
  }

  return null;
}

async function run() {
  console.log(`\n🔧 Fix final — ${TARGETS.length} produits réseau\n${'═'.repeat(60)}`);
  const ok = [], fail = [];

  for (const t of TARGETS) {
    const result = await processTarget(t);

    if (!result || !result.imgs.length) {
      console.log(`  ❌ Aucune source trouvée`);
      fail.push(t.name);
      continue;
    }

    const { error } = await sb.from('products').update({
      main_image_url: result.imgs[0],
      image         : result.imgs[0],
      gallery_urls  : result.imgs,
      gallery       : result.imgs,
      updated_at    : new Date().toISOString(),
    }).eq('id', t.id);

    if (error) {
      console.log(`  ❌ DB: ${error.message}`);
      fail.push(t.name);
    } else {
      console.log(`  💾 Saved (${result.source}) — ${result.imgs[0].slice(0,70)}`);
      ok.push(t.name);
    }

    await sleep(1500);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ Corrigés (${ok.length}): ${ok.join(', ')}`);
  console.log(`❌ Échec    (${fail.length}): ${fail.join(', ')}`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
