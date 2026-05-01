// scripts/fix-reseau-images-v2.js
// Corrige TOUS les produits réseau avec images cassées/manquantes
// Stratégie : fabricant OG + galerie produit + fallback Amazon

const https = require('https');
const http  = require('http');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }, res => {
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
          const loc = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
          return fetchUrl(loc).then(resolve).catch(reject);
        }
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      });
      req.on('error', reject);
      req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
    } catch(e) { reject(e); }
  });
}

function headUrl(url) {
  return new Promise(resolve => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request({ hostname: u.hostname, path: u.pathname, method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 6000 }, res => {
        resolve(res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch { resolve(false); }
  });
}

function extractOgImage(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m?.[1] || null;
}

// Extrait plusieurs images produit d'une page fabricant
function extractProductImages(html, domain) {
  const imgs = new Set();

  // OG image en premier
  const og = extractOgImage(html);
  if (og && og.startsWith('http') && !og.includes('.svg')) imgs.add(og);

  // TP-Link static CDN
  for (const m of html.matchAll(/https:\/\/static\.tp-link\.com\/[^\s"'<>]+\.(?:jpg|png|webp)/gi))
    if (!m[0].includes('icon') && !m[0].includes('logo')) imgs.add(m[0]);

  // ASUS CDN
  for (const m of html.matchAll(/https:\/\/(?:dlcdnimgs|dlcdnwebimgs|www)\.asus\.com\/[^\s"'<>]+\.(?:jpg|png|webp)/gi))
    if (!m[0].includes('icon') && !m[0].includes('logo') && !m[0].includes('banner')) imgs.add(m[0]);

  // Ubiquiti CDN
  for (const m of html.matchAll(/https:\/\/cdn\.ecomm\.ui\.com\/[^\s"'<>]+\.(?:png|jpg|webp)/gi))
    imgs.add(m[0]);

  // Netgear CDN
  for (const m of html.matchAll(/https:\/\/www\.netgear\.com\/content\/dam\/[^\s"'<>]+\.(?:jpg|png|webp)/gi))
    if (!m[0].includes('logo')) imgs.add(m[0]);

  return [...imgs].filter(u => u.length > 30).slice(0, 8);
}

// Extrait images Amazon
function extractAmazonImages(html) {
  const imgs = new Set();
  for (const m of html.matchAll(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
    imgs.add(m[1].replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
  for (const m of html.matchAll(/"large":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
    imgs.add(m[1].replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
  return [...imgs].filter(u => u.length > 50);
}

async function getManufacturerImages(urls) {
  for (const url of urls) {
    try {
      const { status, body } = await fetchUrl(url);
      if (status === 200) {
        const imgs = extractProductImages(body, url);
        if (imgs.length > 0) return imgs;
      }
    } catch {}
    await sleep(500);
  }
  return [];
}

async function getAmazonImages(asin) {
  try {
    const { status, body } = await fetchUrl(`https://www.amazon.fr/dp/${asin}`);
    if (status === 200) return extractAmazonImages(body);
  } catch {}
  return [];
}

// ── Catalogue de fix ──────────────────────────────────────────────────────────
const FIXES = [

  // ── ROUTEURS WIFI ──────────────────────────────────────────────────────────
  { id: 'ccc285b6-0be9-4ff5-b370-99996dafa408', name: 'TP-Link Archer AX55',
    urls: ['https://www.tp-link.com/en/home-networking/wifi-router/archer-ax55/'],
    asin: 'B0CQTQRDQ7' },

  { id: '0cee144e-22d7-4c60-a5bf-f2a150487db8', name: 'ASUS RT-AX56U',
    urls: ['https://www.asus.com/networking-iot-servers/for-home/all-series/rt-ax56u/',
           'https://www.asus.com/fr/networking-iot-servers/for-home/all-series/rt-ax56u/'],
    asin: 'B082VJ4JN5' },

  { id: '7638a19e-5d74-4afa-8138-78ad67b01947', name: 'TP-Link Archer AX20',
    urls: ['https://www.tp-link.com/en/home-networking/wifi-router/archer-ax20/'] },

  { id: '0433e327-4de8-41f6-a903-7f8556e995e6', name: 'TP-Link Archer AX73',
    urls: ['https://www.tp-link.com/en/home-networking/wifi-router/archer-ax73/'] },

  // ── ROUTEURS 4G/5G ────────────────────────────────────────────────────────
  { id: '984f3678-854c-49fd-bfa0-c7f19b628ffa', name: 'TP-Link MR6400',
    urls: ['https://www.tp-link.com/en/home-networking/4g-router/tl-mr6400/'] },

  { id: 'c347cf83-7ead-4abe-a952-c578e6527963', name: 'TP-Link MR100',
    urls: ['https://www.tp-link.com/en/home-networking/4g-router/tl-mr100/'] },

  // ── SWITCHES ──────────────────────────────────────────────────────────────
  { id: 'dfa7a00f-135a-4257-9686-99a343851abf', name: 'Cisco SG350-10',
    urls: ['https://www.cisco.com/c/en/us/products/switches/small-business-smart-switches/sg350-10.html'],
    asin: 'B004D64T3A',
    forced_images: [
      'https://www.cisco.com/c/dam/en/us/products/switches/sg350-10/sg350-10.png',
      'https://i.dell.com/is/image/DellContent/content/dam/ss2/products/networking/network-switches/cisco-sg350-10.jpg',
    ]
  },

  { id: 'cd68bb52-4b21-425a-b51f-d7469f0e23c4', name: 'Netgear GS308',
    urls: ['https://www.netgear.com/fr/home/wired/switches/unmanaged/gs308-300pas/',
           'https://www.netgear.com/home/wired/switches/unmanaged/gs308/'],
    forced_images: [
      'https://www.netgear.com/content/dam/netgear/images/prod/gs308/GS308-100PES_alt-image1.jpg',
      'https://www.netgear.com/content/dam/netgear/images/prod/gs308/GS308-300PAS-alt-image1.png',
    ]
  },

  { id: 'eb670eec-8ffb-4aeb-a38b-994620908a46', name: 'TP-Link TL-SG116E',
    urls: ['https://www.tp-link.com/en/business-networking/smart-switch/tl-sg116e/'] },

  // ── POINTS D'ACCÈS ────────────────────────────────────────────────────────
  { id: '691f966c-d11e-427c-8ce6-6438cd74473f', name: 'ASUS ExpertWiFi EBP68',
    urls: ['https://www.asus.com/networking-iot-servers/for-home/all-series/asus-expertwifi-ebp68/',
           'https://www.asus.com/fr/networking-iot-servers/for-home/all-series/asus-expertwifi-ebp68/'] },

  { id: '7a465d4a-d188-414d-bbae-1d06e5b5f453', name: 'Netgear WAX214',
    urls: ['https://www.netgear.com/fr/business/wifi/access-points/wax214/',
           'https://www.netgear.com/business/wifi/access-points/wax214/'],
    forced_images: [
      'https://www.netgear.com/content/dam/netgear/images/prod/wax214/WAX214-100EUS-alt-image1.jpg',
      'https://www.netgear.com/content/dam/netgear/images/prod/wax214/WAX214-100EUS-hero.png',
    ]
  },

  { id: '4dfa2513-8234-4502-99df-e3349bbd23e0', name: 'TP-Link EAP225',
    urls: ['https://www.tp-link.com/en/business-networking/ceiling-mount-eap/eap225/'] },

  { id: '6e3bc102-313f-497c-8162-711681b6cabe', name: 'TP-Link EAP670',
    urls: ['https://www.tp-link.com/en/business-networking/ceiling-mount-eap/eap670/'] },

  { id: '9766c53e-022d-4b7f-8b4f-3ddaa1c7b8a8', name: 'Ubiquiti UniFi U6 Lite',
    urls: ['https://store.ui.com/us/en/products/u6-lite'],
    forced_images: [
      'https://cdn.ecomm.ui.com/products/259686b4-ae75-411c-90bc-e4040e38ca56/3dac99a9-6352-44f3-ac8b-ade89c707831.png',
      'https://cdn.ecomm.ui.com/products/96d25a27-3a83-4e39-b6cd-b8f906fb36d9/72c33266-f11a-4527-9d10-aa9e36ac06d9.png',
      'https://cdn.ecomm.ui.com/products/2a3c6a8e-e80c-4f35-b6e7-f13cac43a07b/2fcd2f5b-75f7-432e-8a30-90c2d6a36e52.png',
    ]
  },

  // ── CÂBLES ────────────────────────────────────────────────────────────────
  { id: '9c8f3554-ddc2-4b74-acc9-0715d5655ccf', name: 'Câble RJ45 Cat6 Plat 20m',
    forced_images: [
      'https://m.media-amazon.com/images/I/71-q7iyFN8L.jpg',
      'https://m.media-amazon.com/images/I/61H1GRdcfHL.jpg',
    ]
  },
  { id: '459aed6c-3472-4676-b06d-767ac0cb3fc1', name: 'Câble RJ45 Cat6A 10m',
    forced_images: [
      'https://m.media-amazon.com/images/I/71rBEZMbDrL.jpg',
      'https://m.media-amazon.com/images/I/61s+P4TG1ZL.jpg',
    ]
  },
  { id: 'cb8506e6-6382-4ffd-9377-c004d8a650f9', name: 'Câble RJ45 Cat8 2m',
    forced_images: [
      'https://m.media-amazon.com/images/I/81KiTH0fJwL.jpg',
      'https://m.media-amazon.com/images/I/71+s8V01j2L.jpg',
    ]
  },
  { id: 'c4c6897d-469e-42ea-b0d1-3ab76cf7949c', name: 'Testeur câble RJ45',
    forced_images: [
      'https://m.media-amazon.com/images/I/71pHrj5UTNL.jpg',
      'https://m.media-amazon.com/images/I/61Bsz3xYy9L.jpg',
    ]
  },

  // ── ESSENTIELS RÉSEAU ─────────────────────────────────────────────────────
  { id: '0438f76f-65ec-4d15-ab3d-a9cebe50b9b5', name: 'Câble Cat6 5m Amazon',
    forced_images: [
      'https://m.media-amazon.com/images/I/71-q7iyFN8L.jpg',
      'https://m.media-amazon.com/images/I/61H1GRdcfHL.jpg',
    ]
  },
  { id: '8501ba29-d1fa-48cc-be3a-46fc12dcb69e', name: 'Câble Cat6 3m Amazon',
    forced_images: [
      'https://m.media-amazon.com/images/I/71-q7iyFN8L.jpg',
    ]
  },
  { id: '8fea0da0-3c2a-460f-bf28-1b276aa1d2a6', name: 'Prise CPL TP-Link AV1000',
    urls: ['https://www.tp-link.com/en/home-networking/powerline/tl-pa7017p-kit/'] },

  // ── MINEURS (galerie incomplète — on enrichit) ─────────────────────────────
  { id: '85e6b04a-024f-4c9f-b29a-2e072a1bd151', name: 'TP-Link Archer T3U',
    urls: ['https://www.tp-link.com/en/home-networking/adapter/archer-t3u/'] },

  { id: '77802859-a2a7-48cb-97c9-94fba3a9bbfa', name: 'TP-Link RE305',
    urls: ['https://www.tp-link.com/en/home-networking/range-extender/re305/'] },
];

async function run() {
  console.log(`\n🔧 Fix images réseau — ${FIXES.length} produits\n${'─'.repeat(70)}`);
  const results = { ok: [], fail: [] };

  for (const f of FIXES) {
    console.log(`\n📦 ${f.name}`);
    let imgs = [];

    // 1. Forced images (sans fetch)
    if (f.forced_images?.length) {
      console.log(`  📌 Images forcées: ${f.forced_images.length}`);
      // Vérifier qu'au moins la première est accessible
      for (const img of f.forced_images) {
        const ok = await headUrl(img);
        if (ok) { imgs.push(img); console.log(`    ✅ ${img.slice(0,70)}`); }
        else    { console.log(`    ❌ 404: ${img.slice(0,70)}`); }
        await sleep(150);
      }
    }

    // 2. Manufacturer pages
    if (f.urls?.length && imgs.length < 3) {
      console.log(`  🌐 Fabricant: ${f.urls[0].replace(/https?:\/\//,'').slice(0,60)}`);
      const mfgImgs = await getManufacturerImages(f.urls);
      for (const img of mfgImgs) {
        if (!imgs.includes(img)) imgs.push(img);
      }
      if (mfgImgs.length) console.log(`  ✅ ${mfgImgs.length} images fabricant`);
    }

    // 3. Amazon ASIN
    if (f.asin && imgs.length < 3) {
      console.log(`  🛒 Amazon ASIN: ${f.asin}`);
      const amzImgs = await getAmazonImages(f.asin);
      if (amzImgs.length) {
        console.log(`  ✅ ${amzImgs.length} images Amazon`);
        for (const img of amzImgs) if (!imgs.includes(img)) imgs.push(img);
      } else {
        console.log(`  ⚠️  Amazon bloqué`);
      }
    }

    imgs = imgs.slice(0, 5);

    if (!imgs.length) {
      console.log(`  ❌ Aucune image trouvée`);
      results.fail.push(f.name);
      continue;
    }

    console.log(`  📸 ${imgs.length} image(s) finales`);
    const { error } = await sb.from('products').update({
      main_image_url: imgs[0],
      image         : imgs[0],
      gallery_urls  : imgs,
      gallery       : imgs,
      updated_at    : new Date().toISOString(),
    }).eq('id', f.id);

    if (error) {
      console.log(`  ❌ DB: ${error.message}`);
      results.fail.push(f.name);
    } else {
      console.log(`  💾 Sauvegardé — principale: ${imgs[0].slice(0,65)}`);
      results.ok.push(f.name);
    }

    await sleep(1000);
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`✅ Corrigés (${results.ok.length}): ${results.ok.join(', ')}`);
  console.log(`❌ Échec    (${results.fail.length}): ${results.fail.join(', ')}`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
