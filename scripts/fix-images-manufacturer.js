// scripts/fix-images-manufacturer.js
// Récupère les images produit depuis les sites fabricants (TP-Link, ASUS, Netgear, Cisco)
// Usage: node scripts/fix-images-manufacturer.js

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

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
    };
    const req = https.get(url, opts, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return fetchUrl(loc).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, url }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractOgImage(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m?.[1] || null;
}

function extractMainImage(html) {
  // TP-Link specific
  const tplink = html.match(/class="img-responsive"[^>]*src="([^"]+\.(jpg|png|webp))"/i)
               || html.match(/data-src="(https:\/\/static\.tp-link\.com\/[^"]+\.(jpg|png))"/i);
  if (tplink) return tplink[1];

  // ASUS specific
  const asus = html.match(/src="(https:\/\/www\.asus\.com\/[^"]+\.(jpg|png|webp))"/i);
  if (asus) return asus[1];

  // Generic large image
  const generic = html.match(/src="(https:\/\/[^"]+(?:1200|900|large|full)[^"]*\.(jpg|png|webp))"/i);
  if (generic) return generic[1];

  return extractOgImage(html);
}

// Produits à réactiver avec URLs fabricant
const TARGETS = [
  {
    id: '691f966c-d11e-427c-8ce6-6438cd74473f',
    name: 'ASUS ExpertWiFi EBP68',
    brand: 'ASUS',
    urls: [
      'https://www.asus.com/fr/networking-iot-servers/for-home/all-series/asus-expertwifi-ebp68/',
      'https://www.asus.com/networking-iot-servers/for-home/all-series/asus-expertwifi-ebp68/',
    ],
    fallback_images: [
      'https://www.asus.com/media/global/products/3W7bHxfb1P4UJaOG_setting_xxx_0_90_end_1000.jpg',
      'https://dlcdnwebimgs.asus.com/gain/FBCF5A64-AFD0-4EAB-B82E-2DB92DACB3B2/',
    ]
  },
  {
    id: '6e3bc102-313f-497c-8162-711681b6cabe',
    name: 'TP-Link EAP670',
    brand: 'TP-Link',
    urls: [
      'https://www.tp-link.com/fr/business-networking/ceiling-mount-eap/eap670/',
      'https://www.tp-link.com/us/business-networking/ceiling-mount-eap/eap670/',
    ],
    fallback_images: [
      'https://static.tp-link.com/upload/product-img/20210615/EAP670%281%29.jpg',
      'https://static.tp-link.com/EAP670%281%29_v1_1627887480256l.jpg',
    ]
  },
  {
    id: '984f3678-854c-49fd-bfa0-c7f19b628ffa',
    name: 'TP-Link MR6400',
    brand: 'TP-Link',
    urls: [
      'https://www.tp-link.com/fr/home-networking/4g-router/tl-mr6400/',
      'https://www.tp-link.com/us/home-networking/4g-router/tl-mr6400/',
    ],
    fallback_images: [
      'https://static.tp-link.com/2019/201909/20190924/TL-MR6400%281%29.jpg',
    ]
  },
  {
    id: 'eb670eec-8ffb-4aeb-a38b-994620908a46',
    name: 'TP-Link TL-SG116E',
    brand: 'TP-Link',
    urls: [
      'https://www.tp-link.com/fr/business-networking/smart-switch/tl-sg116e/',
      'https://www.tp-link.com/us/business-networking/smart-switch/tl-sg116e/',
    ],
    fallback_images: [
      'https://static.tp-link.com/upload/product-img/20200903/TL-SG116E%281%29.jpg',
    ]
  },
  {
    id: '7a465d4a-d188-414d-bbae-1d06e5b5f453',
    name: 'Netgear WAX214',
    brand: 'Netgear',
    urls: [
      'https://www.netgear.com/fr/business/wifi/access-points/wax214/',
      'https://www.netgear.com/business/wifi/access-points/wax214/',
    ],
    fallback_images: [
      'https://www.netgear.com/content/dam/netgear/images/prod/wax214/WAX214-100EUS-hero.png',
    ]
  },
  {
    id: 'dfa7a00f-135a-4257-9686-99a343851abf',
    name: 'Cisco SG350-10',
    brand: 'Cisco',
    urls: [
      'https://www.cisco.com/c/en/us/products/switches/small-business-smart-switches/sg350-10.html',
    ],
    fallback_images: [
      'https://www.cisco.com/c/dam/en/us/products/collateral/switches/small-business-smart-switches/sg350-10-datasheet.png',
      'https://www.cisco.com/c/dam/assets/prod/switches/sg350-10/1x1.jpg',
    ]
  },
  {
    id: 'cd68bb52-4b21-425a-b51f-d7469f0e23c4',
    name: 'Netgear GS308',
    brand: 'Netgear',
    urls: [
      'https://www.netgear.com/fr/home/wired/switches/unmanaged/gs308/',
      'https://www.netgear.com/home/wired/switches/unmanaged/gs308/',
    ],
    fallback_images: [
      'https://www.netgear.com/content/dam/netgear/images/prod/gs308/GS308-100PES-hero.png',
    ]
  },
  {
    id: 'c347cf83-7ead-4abe-a952-c578e6527963',
    name: 'TP-Link TL-MR100',
    brand: 'TP-Link',
    urls: [
      'https://www.tp-link.com/fr/home-networking/4g-router/tl-mr100/',
      'https://www.tp-link.com/us/home-networking/4g-router/tl-mr100/',
    ],
    fallback_images: [
      'https://static.tp-link.com/TL-MR100%281%29_v1_1597988459037u.jpg',
    ]
  },
  // Câbles et accessoires — images génériques Amazon connues
  {
    id: 'cb8506e6-6382-4ffd-9377-c004d8a650f9',
    name: 'Câble RJ45 Cat8 2m',
    brand: 'Amazon Basics',
    urls: [],
    fallback_images: [
      'https://m.media-amazon.com/images/I/71wM8HjDYZL.jpg',
      'https://m.media-amazon.com/images/I/61gEOEOsaWL.jpg',
    ]
  },
  {
    id: 'c4c6897d-469e-42ea-b0d1-3ab76cf7949c',
    name: 'Testeur de câble réseau RJ45/RJ11',
    brand: 'Générique',
    urls: [],
    fallback_images: [
      'https://m.media-amazon.com/images/I/61jCCuWuH7L.jpg',
      'https://m.media-amazon.com/images/I/71Q6kDzZhAL.jpg',
    ]
  },
  {
    id: '9c8f3554-ddc2-4b74-acc9-0715d5655ccf',
    name: 'Câble RJ45 Cat6 Plat 20m',
    brand: 'Générique',
    urls: [],
    fallback_images: [
      'https://m.media-amazon.com/images/I/61G-clqAqOL.jpg',
      'https://m.media-amazon.com/images/I/71u0ypWfLLL.jpg',
    ]
  },
  {
    id: '459aed6c-3472-4676-b06d-767ac0cb3fc1',
    name: 'Câble RJ45 Cat6A 10m',
    brand: 'Générique',
    urls: [],
    fallback_images: [
      'https://m.media-amazon.com/images/I/61G-clqAqOL.jpg',
    ]
  },
];

async function run() {
  console.log(`\n🏭 Fix images fabricants (${TARGETS.length} produits)\n`);
  const ok = [], fail = [];

  for (const t of TARGETS) {
    console.log(`\n📦 ${t.name} (${t.brand})`);
    let imgFound = null;

    // Essai pages fabricant
    for (const url of t.urls) {
      try {
        console.log(`  🌐 ${url.replace(/https?:\/\//,'').slice(0,60)}`);
        const { status, body } = await fetchUrl(url);
        if (status === 200) {
          const img = extractMainImage(body) || extractOgImage(body);
          if (img && img.startsWith('http')) {
            console.log(`  ✅ Image OG/main: ${img.slice(0,70)}...`);
            imgFound = img;
            break;
          }
        } else {
          console.log(`     Status ${status}`);
        }
      } catch(e) {
        console.log(`     ❌ ${e.message}`);
      }
      await sleep(500);
    }

    // Fallback images connues
    if (!imgFound && t.fallback_images?.length) {
      imgFound = t.fallback_images[0];
      console.log(`  📌 Fallback image: ${imgFound.slice(0,70)}`);
    }

    if (!imgFound) {
      console.log(`  ⚠️  Reste désactivé`);
      fail.push(t.name);
      continue;
    }

    const { error } = await sb.from('products').update({
      main_image_url: imgFound,
      image         : imgFound,
      gallery_urls  : t.fallback_images?.length > 1 ? t.fallback_images : [imgFound],
      gallery       : t.fallback_images?.length > 1 ? t.fallback_images : [imgFound],
      status        : 'active',
      updated_at    : new Date().toISOString(),
    }).eq('id', t.id);

    if (error) { console.log(`  ❌ DB: ${error.message}`); fail.push(t.name); }
    else { console.log(`  💾 Réactivé`); ok.push(t.name); }

    await sleep(800);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Réactivés (${ok.length}): ${ok.join(', ')}`);
  console.log(`❌ Échec     (${fail.length}): ${fail.join(', ')}`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
