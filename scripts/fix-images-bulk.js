// scripts/fix-images-bulk.js
// Corrige les images LDLC/placeholder sur les produits réseau
// Usage: node scripts/fix-images-bulk.js [--dry-run]
const https = require('https');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const DRY_RUN = process.argv.includes('--dry-run');
const DELAY   = 2000; // ms entre requêtes Amazon

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'identity',
      },
    };
    const req = https.get(url, opts, res => {
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

function extractTitle(html) {
  return html.match(/id="productTitle"[^>]*>\s*([^<]+)/)?.[1]?.trim() || null;
}

function extractPrice(html) {
  const whole = html.match(/class="a-price-whole">([0-9\s,]+)</)?.[1]?.replace(/[\s,]/g,'').trim();
  const frac  = html.match(/class="a-price-fraction">([0-9]+)</)?.[1]?.trim() || '00';
  return whole ? parseFloat(`${whole}.${frac}`) : null;
}

// Cherche le premier ASIN sur la page de recherche Amazon
function extractFirstAsin(html) {
  const m = html.match(/\/dp\/([A-Z0-9]{10})/);
  return m?.[1] || null;
}

async function fetchAmazonImages(name, brand) {
  const q = encodeURIComponent(`${brand} ${name}`);
  const searchUrl = `https://www.amazon.fr/s?k=${q}`;
  console.log(`  🔍 Recherche: ${brand} ${name}`);

  const searchRes = await fetchUrl(searchUrl);
  if (searchRes.status !== 200) {
    console.log(`  ⚠️  Search status ${searchRes.status}`);
    return null;
  }

  const asin = extractFirstAsin(searchRes.body);
  if (!asin) {
    console.log(`  ⚠️  Aucun ASIN trouvé`);
    return null;
  }

  console.log(`  📦 ASIN: ${asin}`);
  await sleep(1000);

  const prodUrl = `https://www.amazon.fr/dp/${asin}`;
  const prodRes = await fetchUrl(prodUrl);
  if (prodRes.status !== 200) {
    console.log(`  ⚠️  Prod status ${prodRes.status}`);
    return null;
  }

  const images = extractImages(prodRes.body);
  const title  = extractTitle(prodRes.body);
  const price  = extractPrice(prodRes.body);

  console.log(`  ✅ ${images.length} images | "${title?.slice(0,60)}..." | ${price}€`);
  return { asin, images, title, price, url: prodUrl };
}

// Vérifie si un produit similaire existe déjà (par nom ou ASIN)
async function checkDuplicate(name, asin) {
  const { data } = await sb.from('products')
    .select('id,name,legacy_id')
    .or(`name.ilike.%${name.slice(0,20)}%,legacy_id.eq.${asin}`)
    .limit(5);
  return data || [];
}

// ── Produits à corriger ─────────────────────────────────────────────────────
const PRODUCTS_TO_FIX = [
  // LDLC watermarks — images produit-spécifiques (haute priorité)
  { id: '691f966c-d11e-427c-8ce6-6438cd74473f', name: 'ASUS ExpertWiFi EBP68', brand: 'ASUS',     note: 'ID asus-exp-ax73, image LDLC' },
  { id: '6e3bc102-313f-497c-8162-711681b6cabe', name: 'TP-Link EAP670',        brand: 'TP-Link',  note: 'Image LDLC' },
  { id: '984f3678-854c-49fd-bfa0-c7f19b628ffa', name: 'TP-Link MR6400',        brand: 'TP-Link',  note: 'Image LDLC' },
  { id: 'eb670eec-8ffb-4aeb-a38b-994620908a46', name: 'TP-Link TL-SG116E',     brand: 'TP-Link',  note: 'Image LDLC' },
  { id: '7a465d4a-d188-414d-bbae-1d06e5b5f453', name: 'Netgear WAX214',        brand: 'Netgear',  note: 'Image LDLC' },
  { id: 'dfa7a00f-135a-4257-9686-99a343851abf', name: 'Cisco SG350-10',        brand: 'Cisco',    note: 'Image LDLC' },
  { id: 'cd68bb52-4b21-425a-b51f-d7469f0e23c4', name: 'Netgear GS308',         brand: 'Netgear',  note: 'Image LDLC' },
  { id: 'c347cf83-7ead-4abe-a952-c578e6527963', name: 'TP-Link TL-MR100',      brand: 'TP-Link',  note: 'Image LDLC' },
  // main_image_url null — images tierce mais valides (à juste fixer main_image_url)
  { id: '2c507956-6a42-4ef8-b697-303ccc2b423f', name: 'Huawei B535-232',       brand: 'Huawei',   note: 'main_image_url null', fix_only_main: true },
  { id: 'ee6e5acc-f66e-4e6c-8c42-53bcbbbec582', name: 'Zyxel NR5103E',         brand: 'Zyxel',    note: 'main_image_url null', fix_only_main: true },
  { id: '2f3d9efc-7b76-4544-9c91-684878bf5e4b', name: 'Netgear Nighthawk M6',  brand: 'Netgear',  note: 'main_image_url null', fix_only_main: true },
  { id: 'ccc285b6-0be9-4ff5-b370-99996dafa408', name: 'ASUS RT-AX58U',         brand: 'ASUS',     note: 'main_image_url null', fix_only_main: true },
  { id: '0cee144e-22d7-4c60-a5bf-f2a150487db8', name: 'Netgear Nighthawk AX5', brand: 'Netgear',  note: 'main_image_url null', fix_only_main: true },
  // Câbles/accessoires avec mauvaise image — désactiver si pas d'image propre
  { id: '0438f76f-65ec-4d15-ab3d-a9cebe50b9b5', name: 'Kit Réseau Starter',    brand: 'TP-Link',  note: 'Placeholder LDLC' },
  { id: 'cb8506e6-6382-4ffd-9377-c004d8a650f9', name: 'Câble RJ45 Cat8 2m',    brand: 'Générique',note: 'Placeholder LDLC' },
  { id: 'c4c6897d-469e-42ea-b0d1-3ab76cf7949c', name: 'Testeur câble RJ45',    brand: 'Générique',note: 'Placeholder LDLC' },
  { id: '9c8f3554-ddc2-4b74-acc9-0715d5655ccf', name: 'Câble RJ45 Cat6 Plat 20m', brand: 'Générique', note: 'Placeholder LDLC' },
  { id: '459aed6c-3472-4676-b06d-767ac0cb3fc1', name: 'Câble RJ45 Cat6A 10m',  brand: 'Générique',note: 'Placeholder LDLC' },
  { id: '8501ba29-d1fa-48cc-be3a-46fc12dcb69e', name: 'Pack Bureau Connecté',  brand: 'Générique',note: 'Placeholder LDLC' },
];

async function fixMainImageOnly(p) {
  const { data } = await sb.from('products')
    .select('gallery_urls, gallery')
    .eq('id', p.id).single();
  const gallery = data?.gallery_urls || data?.gallery || [];
  const firstImg = gallery[0];
  if (!firstImg) { console.log(`  ⚠️  Aucune image en galerie`); return false; }
  if (DRY_RUN) { console.log(`  DRY RUN — setrait: main_image_url = ${firstImg}`); return true; }
  const { error } = await sb.from('products').update({
    main_image_url: firstImg,
    image: firstImg,
    updated_at: new Date().toISOString(),
  }).eq('id', p.id);
  if (error) { console.log(`  ❌ ${error.message}`); return false; }
  console.log(`  ✅ main_image_url fixé: ${firstImg}`);
  return true;
}

async function run() {
  console.log(`\n🛠️  Fix images bulk — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   ${PRODUCTS_TO_FIX.length} produits à traiter\n`);

  const results = { fixed: [], skipped: [], failed: [] };

  for (const p of PRODUCTS_TO_FIX) {
    console.log(`\n📦 ${p.name} (${p.brand}) — ${p.note}`);

    // Fix rapide : main_image_url depuis galerie existante
    if (p.fix_only_main) {
      const ok = await fixMainImageOnly(p);
      (ok ? results.fixed : results.failed).push(p.name);
      continue;
    }

    // Vérifier doublon possible
    const dupes = await checkDuplicate(p.name, '');
    if (dupes.length > 1) {
      const names = dupes.map(d => d.name).join(', ');
      console.log(`  ℹ️  Produits similaires: ${names}`);
    }

    // Fetch Amazon
    let amz;
    try {
      amz = await fetchAmazonImages(p.name, p.brand);
    } catch(e) {
      console.log(`  ❌ Erreur fetch: ${e.message}`);
      results.failed.push(p.name);
      await sleep(DELAY);
      continue;
    }

    if (!amz || !amz.images.length) {
      console.log(`  ⏭️  Aucune image — désactivation du produit`);
      if (!DRY_RUN) {
        await sb.from('products').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('id', p.id);
      }
      results.skipped.push(p.name);
      await sleep(DELAY);
      continue;
    }

    if (!DRY_RUN) {
      const update = {
        main_image_url : amz.images[0],
        image          : amz.images[0],
        gallery_urls   : amz.images.slice(0, 5),
        gallery        : amz.images.slice(0, 5),
        updated_at     : new Date().toISOString(),
      };
      // Mise à jour prix si Amazon a un prix (et que c'est raisonnable)
      if (amz.price && amz.price > 0 && Math.abs(amz.price - (p.price_eur || 0)) < 200) {
        update.price_eur = amz.price;
        update.price_kmf = Math.round(amz.price * 492);
      }
      const { error } = await sb.from('products').update(update).eq('id', p.id);
      if (error) { console.log(`  ❌ DB: ${error.message}`); results.failed.push(p.name); }
      else { console.log(`  💾 Mis à jour en base`); results.fixed.push(p.name); }
    } else {
      console.log(`  DRY RUN — image: ${amz.images[0]}`);
      results.fixed.push(p.name);
    }

    await sleep(DELAY);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Corrigés  (${results.fixed.length}): ${results.fixed.join(', ') || '—'}`);
  console.log(`⏭️  Ignorés   (${results.skipped.length}): ${results.skipped.join(', ') || '—'}`);
  console.log(`❌ Échoués   (${results.failed.length}): ${results.failed.join(', ') || '—'}`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
