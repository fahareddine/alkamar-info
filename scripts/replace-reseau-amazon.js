// scripts/replace-reseau-amazon.js
// Remplace TOUS les produits réseau par des produits Amazon.fr avec images propres
// Usage: node scripts/replace-reseau-amazon.js

const https = require('https');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const DELAY = 3000;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
      },
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location)
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
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

// ── Catalogue de remplacement ────────────────────────────────────────────────
// Chaque produit = { target_id, asin, name, brand, cat_slug, price_eur, features, specs }
const REPLACEMENTS = [

  // ── ROUTEURS WIFI ───────────────────────────────────────────────────────────
  { target_id: 'ccc285b6-0be9-4ff5-b370-99996dafa408', // ASUS RT-AX58U
    asin: 'B0CQTQRDQ7', name: 'TP-Link Archer AX55 WiFi 6', brand: 'TP-Link',
    cat_slug: 'routeur-wifi', price_eur: 79.99,
    badge: 'WiFi 6', badge_class: 'badge--popular',
    features: ['WiFi 6 AX3000 double bande','4 ports Gigabit LAN','USB 3.0 partage fichiers','Technologie OFDMA + MU-MIMO','Compatible tous opérateurs'],
    specs: { 'Standard': 'WiFi 6 (802.11ax)', 'Bandes': 'Dual Band 2.4+5 GHz', 'Vitesse': 'AX3000 (3000 Mbps)', 'Ports LAN': '4x Gigabit', 'USB': 'USB 3.0' }
  },
  { target_id: '0cee144e-22d7-4c60-a5bf-f2a150487db8', // Netgear Nighthawk AX5
    asin: 'B0D17FCXBL', name: 'ASUS RT-AX56U WiFi 6 AX1800', brand: 'ASUS',
    cat_slug: 'routeur-wifi', price_eur: 89.99,
    badge: 'WiFi 6', badge_class: 'badge--popular',
    features: ['WiFi 6 AX1800','4 ports Gigabit LAN','MU-MIMO & OFDMA','AiProtection sécurité réseau','Gestion via app ASUS Router'],
    specs: { 'Standard': 'WiFi 6 (802.11ax)', 'Bandes': 'Dual Band', 'Vitesse': 'AX1800', 'Ports': '4x Gigabit LAN', 'Sécurité': 'WPA3' }
  },
  { target_id: '7638a19e-5d74-4afa-8138-78ad67b01947', // TP-Link Archer AX20
    asin: 'B08D3FGMLB', name: 'TP-Link Archer AX20 WiFi 6', brand: 'TP-Link',
    cat_slug: 'routeur-wifi', price_eur: 59.99,
    badge: 'Bon prix', badge_class: 'badge--deal',
    features: ['WiFi 6 AX1800 double bande','4 ports Gigabit','OFDMA pour plus d\'appareils simultanés','Beamforming intelligent','Installation en 5 min via Tether App'],
    specs: { 'Standard': 'WiFi 6', 'Vitesse': 'AX1800', 'Ports LAN': '4x Gigabit', 'Ports WAN': '1x Gigabit' }
  },
  { target_id: '0433e327-4de8-41f6-a903-7f8556e995e6', // TP-Link Archer AX73
    asin: 'B09B92LFN7', name: 'TP-Link Archer AX73 WiFi 6 AX5400', brand: 'TP-Link',
    cat_slug: 'routeur-wifi', price_eur: 109.99,
    badge: 'WiFi 6', badge_class: 'badge--popular',
    features: ['WiFi 6 AX5400 tri-bande','6 antennes hautes performances','Processeur 1.5 GHz triple cœur','OFDMA + MU-MIMO 4×4','USB 3.0 pour NAS maison'],
    specs: { 'Standard': 'WiFi 6', 'Vitesse': 'AX5400', 'Bandes': 'Dual Band', 'Antennes': '6 externes', 'USB': 'USB 3.0' }
  },

  // ── ROUTEURS 4G/5G ─────────────────────────────────────────────────────────
  { target_id: '984f3678-854c-49fd-bfa0-c7f19b628ffa', // TP-Link MR6400
    asin: 'B07BM9H698', name: 'TP-Link TL-MR6400 Routeur 4G LTE', brand: 'TP-Link',
    cat_slug: 'routeur-4g5g', price_eur: 79.99,
    badge: '4G LTE', badge_class: 'badge--popular',
    features: ['4G LTE jusqu\'à 150 Mbps','WiFi N300 double bande','4 ports Gigabit LAN','Compatible SIM nano','Sans câble opérateur nécessaire'],
    specs: { 'Type': '4G LTE Cat4', 'WiFi': 'N300', 'Ports LAN': '4x 100 Mbps', 'SIM': 'Nano SIM', 'Fréquences': 'LTE B1/3/5/7/8/20' }
  },
  { target_id: 'c347cf83-7ead-4abe-a952-c578e6527963', // TP-Link TL-MR100
    asin: 'B08VDNCS1V', name: 'TP-Link TL-MR100 Routeur 4G LTE N300', brand: 'TP-Link',
    cat_slug: 'routeur-4g5g', price_eur: 44.99,
    badge: 'Entrée gamme', badge_class: 'badge--deal',
    features: ['4G LTE 150 Mbps','WiFi N300 2.4 GHz','4 ports LAN Fast Ethernet','Nano SIM','Plug & Play simple'],
    specs: { 'Type': '4G LTE Cat4', 'WiFi': 'N300 2.4 GHz', 'Ports': '4x 100 Mbps', 'SIM': 'Nano SIM' }
  },

  // ── SWITCHES ───────────────────────────────────────────────────────────────
  { target_id: '1587f10e-3224-42ce-9e65-ad95bf45812a', // TP-Link TL-SG105
    asin: 'B000N99BBC', name: 'TP-Link TL-SG105 Switch 5 ports Gigabit', brand: 'TP-Link',
    cat_slug: 'switch', price_eur: 14.99,
    badge: 'Bestseller', badge_class: 'badge--best',
    features: ['5 ports Gigabit 10/100/1000 Mbps','Plug & Play sans configuration','Boîtier métal compact','Auto MDI/MDIX','Idéal bureau ou domicile'],
    specs: { 'Ports': '5x Gigabit', 'Type': 'Non géré', 'Vitesse': '10/100/1000 Mbps', 'Boîtier': 'Métal', 'Alimentation': 'Externe' }
  },
  { target_id: 'a3fb16fb-a7f1-4c65-86aa-5d805a07e554', // TP-Link TL-SG108
    asin: 'B00A128S24', name: 'TP-Link TL-SG108 Switch 8 ports Gigabit', brand: 'TP-Link',
    cat_slug: 'switch', price_eur: 22.99,
    badge: 'Populaire', badge_class: 'badge--popular',
    features: ['8 ports Gigabit 10/100/1000','Plug & Play','Boîtier métal robuste','IGMP snooping automatique','LED indicateurs par port'],
    specs: { 'Ports': '8x Gigabit', 'Type': 'Non géré', 'Boîtier': 'Métal', 'Norme': 'IEEE 802.3ab' }
  },
  { target_id: 'cd68bb52-4b21-425a-b51f-d7469f0e23c4', // Netgear GS308
    asin: 'B07HGL9WXY', name: 'Netgear GS308 Switch 8 ports Gigabit', brand: 'Netgear',
    cat_slug: 'switch', price_eur: 24.99,
    features: ['8 ports Gigabit','Plug & Play','Boîtier métal élégant','Silencieux sans ventilateur','Économie d\'énergie auto'],
    specs: { 'Ports': '8x Gigabit', 'Type': 'Non géré', 'Boîtier': 'Métal' }
  },

  // ── POINTS D'ACCÈS ──────────────────────────────────────────────────────────
  { target_id: '4dfa2513-8234-4502-99df-e3349bbd23e0', // TP-Link EAP225
    asin: 'B07B6JFMNR', name: 'TP-Link EAP225 Point d\'accès WiFi 5 AC1350', brand: 'TP-Link',
    cat_slug: 'point-acces', price_eur: 49.99,
    badge: 'WiFi 5', badge_class: 'badge--popular',
    features: ['WiFi 5 AC1350 double bande','PoE 802.3af inclus','Montage plafond','Gestion centralisée Omada','LED indicateur d\'état'],
    specs: { 'Standard': 'WiFi 5 AC1350', 'PoE': '802.3af', 'Montage': 'Plafond', 'Bandes': '2.4 + 5 GHz' }
  },

  // ── CÂBLES RÉSEAU ──────────────────────────────────────────────────────────
  { target_id: '0438f76f-65ec-4d15-ab3d-a9cebe50b9b5', // Kit Réseau Starter
    asin: 'B01IGFBLON', name: 'Amazon Basics Câble RJ45 Cat6 5m', brand: 'Amazon Basics',
    cat_slug: 'cable', price_eur: 7.99,
    badge: 'Essentiel', badge_class: 'badge--stock',
    features: ['Cat6 jusqu\'à 10 Gbps','Gaine blindée SFTP','Connecteurs RJ45 plaqués or','Longueur 5 mètres','Compatible PoE'],
    specs: { 'Catégorie': 'Cat6', 'Longueur': '5 m', 'Débit max': '10 Gbps', 'Blindage': 'SFTP' }
  },
  { target_id: '8501ba29-d1fa-48cc-be3a-46fc12dcb69e', // Pack Bureau Connecté
    asin: 'B01IGFBLQO', name: 'Amazon Basics Câble RJ45 Cat6 3m', brand: 'Amazon Basics',
    cat_slug: 'cable', price_eur: 6.99,
    features: ['Cat6 10 Gbps','Blindage SFTP','Connecteurs plaqués or','3 mètres'],
    specs: { 'Catégorie': 'Cat6', 'Longueur': '3 m', 'Débit max': '10 Gbps' }
  },

  // ── ESSENTIELS RÉSEAU ──────────────────────────────────────────────────────
  { target_id: '77802859-a2a7-48cb-97c9-94fba3a9bbfa', // Répéteur TP-Link RE305
    asin: 'B073H62X36', name: 'TP-Link RE305 Répéteur WiFi AC1200', brand: 'TP-Link',
    cat_slug: 'essentiel-reseau', price_eur: 29.99,
    badge: 'Répéteur', badge_class: 'badge--popular',
    features: ['Amplifie le signal WiFi AC1200','Double bande 2.4 + 5 GHz','Port Ethernet Gigabit','LED indicateur de signal','Compatible tous routeurs'],
    specs: { 'Standard': 'AC1200', 'Bandes': 'Dual Band', 'Port': '1x Gigabit Ethernet' }
  },
  { target_id: '85e6b04a-024f-4c9f-b29a-2e072a1bd151', // Clé WiFi USB
    asin: 'B0BDZ7KQB5', name: 'TP-Link Archer T3U Clé WiFi USB AC1300', brand: 'TP-Link',
    cat_slug: 'essentiel-reseau', price_eur: 19.99,
    badge: 'Pratique', badge_class: 'badge--popular',
    features: ['WiFi AC1300 dual band','USB 3.0 haute vitesse','Antenne pliable orientable','Compatible Windows & Mac','Plug & Play'],
    specs: { 'Standard': 'AC1300', 'Interface': 'USB 3.0', 'Bandes': '2.4 + 5 GHz' }
  },
];

async function fetchAmazon(asin) {
  const url = `https://www.amazon.fr/dp/${asin}`;
  try {
    const { status, body } = await fetchUrl(url);
    if (status !== 200) return null;
    const imgs = extractImages(body);
    if (!imgs.length) return null;
    return {
      images: imgs.slice(0, 5),
      title : extractTitle(body),
      price : extractPrice(body),
    };
  } catch(e) {
    return null;
  }
}

async function run() {
  console.log(`\n🛒 Remplacement section Réseau — ${REPLACEMENTS.length} produits\n${'─'.repeat(60)}`);

  const ok = [], fail = [];

  for (const r of REPLACEMENTS) {
    console.log(`\n📦 ${r.name} (${r.brand}) ASIN:${r.asin}`);

    let amz = await fetchAmazon(r.asin);

    if (amz) {
      console.log(`  ✅ Amazon: ${amz.images.length} images | ${amz.price}€ | ${(amz.title||'').slice(0,50)}`);
    } else {
      console.log(`  ⚠️  Amazon bloqué — images fabricant fallback`);
    }

    const imgs = amz?.images || [];
    const price = (amz?.price && amz.price > 0) ? amz.price : r.price_eur;

    const update = {
      name          : r.name,
      brand         : r.brand,
      badge         : r.badge || null,
      badge_class   : r.badge_class || null,
      main_image_url: imgs[0] || null,
      image         : imgs[0] || null,
      gallery_urls  : imgs.length ? imgs : null,
      gallery       : imgs.length ? imgs : null,
      price_eur     : price,
      price_kmf     : Math.round(price * 492),
      features      : r.features || [],
      specs         : r.specs || {},
      status        : 'active',
      updated_at    : new Date().toISOString(),
    };

    const { error } = await sb.from('products').update(update).eq('id', r.target_id);
    if (error) {
      console.log(`  ❌ DB: ${error.message}`);
      fail.push(r.name);
    } else {
      console.log(`  💾 Mis à jour — ${imgs.length ? imgs.length + ' images' : 'PAS D\'IMAGE (besoin fix)'}`);
      ok.push(r.name);
    }

    await sleep(DELAY);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ OK    (${ok.length}): ${ok.join(', ')}`);
  console.log(`❌ FAIL  (${fail.length}): ${fail.join(', ')}`);
  console.log(`\n💡 Pour les produits sans image: relance plus tard ou utilise fix-images-manufacturer.js`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
