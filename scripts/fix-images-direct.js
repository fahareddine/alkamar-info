// scripts/fix-images-direct.js
// Reactivate products deactivated by fix-images-bulk.js using direct Amazon ASINs
// Usage: node scripts/fix-images-direct.js

const https = require('https');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const DELAY = 2500;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'identity',
      },
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location)
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractImages(html) {
  const imgs = new Set();
  for (const m of html.matchAll(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
    imgs.add(m[1].replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
  for (const m of html.matchAll(/"large":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
    imgs.add(m[1].replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
  for (const m of html.matchAll(/data-old-hires="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
    imgs.add(m[1].replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
  return [...imgs].filter(u => u.length > 50);
}

function extractTitle(html) { return html.match(/id="productTitle"[^>]*>\s*([^<]+)/)?.[1]?.trim(); }
function extractPrice(html) {
  const w = html.match(/class="a-price-whole">([0-9\s,]+)</)?.[1]?.replace(/[\s,]/g,'').trim();
  const f = html.match(/class="a-price-fraction">([0-9]+)</)?.[1] || '00';
  return w ? parseFloat(`${w}.${f}`) : null;
}

// Produits à réactiver avec ASINs connus
const TARGETS = [
  // Réseau WiFi
  { id: '691f966c-d11e-427c-8ce6-6438cd74473f', name: 'ASUS ExpertWiFi EBP68', asin: 'B0CZW8HDWW', fallback_asin: 'B09SZGLTZ5' },
  { id: '6e3bc102-313f-497c-8162-711681b6cabe', name: 'TP-Link EAP670',        asin: 'B09BG7RRZS', fallback_asin: 'B08YNG3SMM' },
  { id: '984f3678-854c-49fd-bfa0-c7f19b628ffa', name: 'TP-Link MR6400',        asin: 'B07BM9H698', fallback_asin: 'B07BLTH9MB' },
  { id: 'eb670eec-8ffb-4aeb-a38b-994620908a46', name: 'TP-Link TL-SG116E',     asin: 'B097B65CK8', fallback_asin: 'B01MDPPPF7' },
  { id: '7a465d4a-d188-414d-bbae-1d06e5b5f453', name: 'Netgear WAX214',        asin: 'B09DNG89JB', fallback_asin: 'B09WC11CPP' },
  { id: 'dfa7a00f-135a-4257-9686-99a343851abf', name: 'Cisco SG350-10',        asin: 'B004D64T3A', fallback_asin: 'B0752QXLY2' },
  { id: 'cd68bb52-4b21-425a-b51f-d7469f0e23c4', name: 'Netgear GS308',         asin: 'B07HGL9WXY', fallback_asin: 'B00M1C034K' },
  { id: 'c347cf83-7ead-4abe-a952-c578e6527963', name: 'TP-Link TL-MR100',      asin: 'B07MTJFKQ6', fallback_asin: 'B08DQRMDYW' },
  // Câbles/accessoires — Amazon générique
  { id: 'cb8506e6-6382-4ffd-9377-c004d8a650f9', name: 'Câble RJ45 Cat8 2m',    asin: 'B07BTXKH39', fallback_asin: 'B08GVVYQ2Y' },
  { id: 'c4c6897d-469e-42ea-b0d1-3ab76cf7949c', name: 'Testeur câble RJ45',    asin: 'B01N1U2KZ2', fallback_asin: 'B083G8H5KS' },
  { id: '9c8f3554-ddc2-4b74-acc9-0715d5655ccf', name: 'Câble RJ45 Cat6 Plat 20m', asin: 'B01MQ0GXJX', fallback_asin: 'B07R9W7BBG' },
  { id: '459aed6c-3472-4676-b06d-767ac0cb3fc1', name: 'Câble RJ45 Cat6A 10m',  asin: 'B00LYGFK5S', fallback_asin: 'B07JFDD8Q1' },
];

async function tryFetch(asin) {
  const url = `https://www.amazon.fr/dp/${asin}`;
  const { status, body } = await fetchUrl(url);
  if (status !== 200) return null;
  const imgs = extractImages(body);
  if (!imgs.length) return null;
  return { asin, images: imgs, title: extractTitle(body), price: extractPrice(body) };
}

async function run() {
  console.log(`\n🔧 Fix images direct (${TARGETS.length} produits)\n`);
  const ok = [], fail = [];

  for (const t of TARGETS) {
    console.log(`\n📦 ${t.name}`);

    let result = null;
    for (const asin of [t.asin, t.fallback_asin].filter(Boolean)) {
      console.log(`  📥 ASIN ${asin}...`);
      try { result = await tryFetch(asin); } catch(e) { console.log(`     ❌ ${e.message}`); }
      if (result) break;
      await sleep(1000);
    }

    if (!result) {
      console.log(`  ⚠️  Aucune image trouvée — reste désactivé`);
      fail.push(t.name);
      await sleep(DELAY);
      continue;
    }

    console.log(`  ✅ ${result.images.length} images | ${result.price}€ | ${result.title?.slice(0,50)}...`);
    console.log(`  🖼️  ${result.images[0]}`);

    const update = {
      main_image_url: result.images[0],
      image         : result.images[0],
      gallery_urls  : result.images.slice(0, 5),
      gallery       : result.images.slice(0, 5),
      status        : 'active',
      updated_at    : new Date().toISOString(),
    };
    if (result.price && result.price > 0) {
      update.price_eur = result.price;
      update.price_kmf = Math.round(result.price * 492);
    }

    const { error } = await sb.from('products').update(update).eq('id', t.id);
    if (error) { console.log(`  ❌ DB: ${error.message}`); fail.push(t.name); }
    else { console.log(`  💾 Réactivé avec images propres`); ok.push(t.name); }

    await sleep(DELAY);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Réactivés (${ok.length}): ${ok.join(', ') || '—'}`);
  console.log(`❌ Échec     (${fail.length}): ${fail.join(', ') || '—'}`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
