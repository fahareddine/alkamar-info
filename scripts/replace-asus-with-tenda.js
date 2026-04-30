// scripts/replace-asus-with-tenda.js
// Remplace l'ASUS ROG Rapture GT-AX6000 (images LDLC) par Tenda AX1500 (B0DK579HVY)
// Usage: node scripts/replace-asus-with-tenda.js

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const TENDA_ASIN = 'B0DK579HVY';
const TENDA_URL  = `https://www.amazon.fr/dp/${TENDA_ASIN}`;

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'identity',
      },
    };
    const req = https.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractImages(html) {
  const images = new Set();
  for (const m of html.matchAll(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
    images.add(m[1].replace(/\._AC_[A-Z0-9,_]+_/g, ''));
  for (const m of html.matchAll(/"large":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
    images.add(m[1].replace(/\._AC_[A-Z0-9,_]+_/g, ''));
  for (const m of html.matchAll(/data-old-hires="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
    images.add(m[1].replace(/\._AC_[A-Z0-9,_]+_/g, ''));
  return [...images].filter(u => u.length > 50);
}

function extractTitle(html) {
  return html.match(/id="productTitle"[^>]*>\s*([^<]+)/)?.[1]?.trim() || null;
}

function extractPrice(html) {
  const whole = html.match(/class="a-price-whole">([0-9,\s]+)</)?.[1]?.trim().replace(/\s/g, '');
  const frac  = html.match(/class="a-price-fraction">([0-9]+)</)?.[1]?.trim() || '00';
  return whole ? parseFloat(`${whole}.${frac}`) : null;
}

function extractBullets(html) {
  const bullets = [];
  for (const m of html.matchAll(/<span class="a-list-item">\s*([^<]{10,200})\s*<\/span>/g)) {
    const text = m[1].trim().replace(/\s+/g, ' ');
    if (text && !text.includes('Voir plus') && bullets.length < 5) bullets.push(text);
  }
  return bullets;
}

async function run() {
  console.log('🔍 Recherche ASUS ROG GT-AX6000 en base...');

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, category_id')
    .ilike('name', '%GT-AX6000%');

  if (error) { console.error('❌ Supabase:', error.message); process.exit(1); }
  if (!products.length) { console.error('❌ Produit GT-AX6000 non trouvé'); process.exit(1); }

  const prod = products[0];
  console.log(`✅ Trouvé: ${prod.name} (ID: ${prod.id})`);
  console.log(`\n📦 Fetch Amazon: ${TENDA_URL}`);

  const { status, body } = await fetchUrl(TENDA_URL);
  console.log(`   Status: ${status}`);

  if (status !== 200) {
    console.error('❌ Amazon a retourné', status, '— essaie manuellement sur le navigateur');
    process.exit(1);
  }

  const images  = extractImages(body);
  const title   = extractTitle(body);
  const price   = extractPrice(body);
  const bullets = extractBullets(body);

  console.log(`\n📋 Données extraites:`);
  console.log(`   Titre   : ${title}`);
  console.log(`   Prix    : ${price} €`);
  console.log(`   Images  : ${images.length} trouvées`);
  images.forEach((u, i) => console.log(`     [${i}] ${u}`));
  console.log(`   Points  : ${bullets.length}`);
  bullets.forEach(b => console.log(`     • ${b}`));

  if (!images.length) {
    console.error('\n❌ Aucune image extraite — Amazon a peut-être bloqué la requête');
    console.log('💡 Lance: node scripts/replace-asus-with-tenda.js  (réessaie dans 30s)');
    process.exit(1);
  }

  const newData = {
    name          : title || 'Tenda Routeur WiFi 6 AX1500 Double Bande',
    subtitle      : 'WiFi 6 AX1500 · Double bande · 4 ports Gigabit',
    brand         : 'Tenda',
    category_id   : prod.category_id,
    badge         : 'Nouveau',
    badge_class   : 'badge--new',
    main_image_url: images[0],
    gallery_urls  : images.slice(0, 5),
    image         : images[0],
    gallery       : images.slice(0, 5),
    price_eur     : price || 49.99,
    price_kmf     : Math.round((price || 49.99) * 492),
    price_old     : null,
    features      : bullets.length ? bullets : [
      'WiFi 6 AX1500 double bande',
      '4 ports Gigabit LAN + 1 port Gigabit WAN',
      'Facile à configurer via app Tenda',
      'Couverture jusqu\'à 120 m²',
      'Compatible avec tous les FAI',
    ],
    stock_label   : 'En stock',
    status        : 'active',
    sku           : `TENDA-${TENDA_ASIN}`,
    specs: {
      'Standard WiFi' : 'WiFi 6 (802.11ax)',
      'Bandes'        : 'Double bande (2.4 GHz + 5 GHz)',
      'Vitesse max'   : 'AX1500 (300 + 1201 Mbps)',
      'Ports LAN'     : '4x Gigabit',
      'Port WAN'      : '1x Gigabit',
      'Marque'        : 'Tenda',
      'Garantie'      : '2 ans',
    },
    updated_at    : new Date().toISOString(),
  };

  console.log('\n💾 Mise à jour en base...');
  const { error: updErr } = await supabase
    .from('products')
    .update(newData)
    .eq('id', prod.id);

  if (updErr) { console.error('❌ Update échoué:', updErr.message); process.exit(1); }

  console.log(`\n✅ Produit mis à jour avec succès !`);
  console.log(`   URL produit : https://alkamar-info.vercel.app/produit.html?id=${prod.id}`);
  console.log(`   Image principale : ${images[0]}`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
