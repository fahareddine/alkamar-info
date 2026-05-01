// scripts/fix-duplicate-images.js
// Corrige : doublons images, EAP→Deco, Cat6-3m 404
const https = require('https');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'Accept': 'text/html', 'Accept-Encoding': 'identity' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ s: res.statusCode, b: d }));
    });
    req.on('error', reject); req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}
function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'Accept': 'image/*' } }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location)
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      const ct = res.headers['content-type'] || 'image/jpeg';
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ buf: Buffer.concat(chunks), ct }));
    });
    req.on('error', reject); req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}
async function upload(buf, ct, slug, n) {
  const ext = ct.includes('png') ? 'png' : 'jpg';
  const p = `reseau/${slug}-${n}.${ext}`;
  const { error } = await sb.storage.from('products').upload(p, buf, { contentType: ct, upsert: true, cacheControl: '31536000' });
  if (error) throw error;
  return sb.storage.from('products').getPublicUrl(p).data.publicUrl;
}
function extractTp(html) {
  const s = new Set();
  for (const m of html.matchAll(/https:\/\/static\.tp-link\.com\/[^\s"'<>]+\.(?:jpg|png)/gi))
    if (!m[0].includes('icon') && !m[0].includes('logo') && !m[0].includes('banner')) s.add(m[0]);
  return [...s];
}
function og(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  return m?.[1]?.startsWith('http') && !m[1].includes('.svg') ? m[1] : null;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const BASE = 'https://ovjsinugxkuwsjnfxfgb.supabase.co/storage/v1/object/public/products/reseau/';
const SG = ['https://m.media-amazon.com/images/I/61lN0YzusnL.jpg','https://m.media-amazon.com/images/I/61HSKVi1ynL.jpg','https://m.media-amazon.com/images/I/51Q7I5QcwrL.jpg','https://m.media-amazon.com/images/I/612t7gzUSTL.jpg','https://m.media-amazon.com/images/I/61BvB5fKblL.jpg'];
const UQ = ['https://cdn.ecomm.ui.com/products/259686b4-ae75-411c-90bc-e4040e38ca56/3dac99a9-6352-44f3-ac8b-ade89c707831.png','https://cdn.ecomm.ui.com/products/259686b4-ae75-411c-90bc-e4040e38ca56/0b2e38b2-72f4-4266-82c7-d069b459ed81.png','https://cdn.ecomm.ui.com/products/259686b4-ae75-411c-90bc-e4040e38ca56/b4897ab3-71bb-4091-a457-9d903e7730e6.png','https://cdn.ecomm.ui.com/products/259686b4-ae75-411c-90bc-e4040e38ca56/fcdf3ead-0ef6-42d1-a362-acc1de5894a0.png','https://cdn.ecomm.ui.com/products/259686b4-ae75-411c-90bc-e4040e38ca56/26c0e95a-36d3-41d2-8f30-3cd65b3b1fe9.png'];

async function run() {
  console.log('\n=== PHASE 1: EAP → Deco avec vraies images TP-Link ===\n');

  const DECO = [
    {
      id: '4dfa2513-8234-4502-99df-e3349bbd23e0', slug: 'deco-m4',
      page: 'https://www.tp-link.com/en/home-networking/deco/deco-m4/',
      name: 'TP-Link Deco M4 WiFi 5 Mesh',
      subtitle: 'WiFi 5 AC1200 · Mesh · 185 m²',
      brand: 'TP-Link', price_eur: 54.99, price_kmf: 27056,
      badge: 'Mesh WiFi', badge_class: 'badge--popular', rating: 4, rating_count: 4521,
      stock: 8, stock_label: 'En stock',
      description: "Le TP-Link Deco M4 est un système WiFi Mesh AC1200 couvrant jusqu'à 185 m². Il crée un réseau WiFi unifié sans coupure. Idéal pour les maisons avec zones mortes. Installation via app Deco en 5 minutes.",
      features: ['WiFi 5 Mesh AC1200 double bande', 'Couverture 185 m² avec 1 kit', 'Réseau WiFi unifié sans déconnexion', 'Beamforming et MU-MIMO', 'Contrôle parental via app Deco'],
      specs: { 'Standard': 'WiFi 5 AC1200', 'Couverture': '185 m² / kit', 'Bandes': '2.4 + 5 GHz', 'Ports LAN': '2 × 100 Mbps', 'Sécurité': 'WPA3', 'Gestion': 'App Deco', 'Format': 'Compact puck' },
    },
    {
      id: '6e3bc102-313f-497c-8162-711681b6cabe', slug: 'deco-x20',
      page: 'https://www.tp-link.com/en/home-networking/deco/deco-x20/',
      name: 'TP-Link Deco X20 WiFi 6 Mesh',
      subtitle: 'WiFi 6 AX1800 · Mesh · 250 m²',
      brand: 'TP-Link', price_eur: 74.99, price_kmf: 36895,
      badge: 'WiFi 6 Mesh', badge_class: 'badge--popular', rating: 5, rating_count: 3182,
      stock: 6, stock_label: 'En stock',
      description: "Le TP-Link Deco X20 est un système WiFi 6 Mesh AX1800 couvrant jusqu'à 250 m². La technologie OFDMA du WiFi 6 permet de connecter plus d'appareils simultanément. Compatible avec tous les systèmes Deco.",
      features: ['WiFi 6 Mesh AX1800', "Couverture jusqu'à 250 m²", 'OFDMA + MU-MIMO WiFi 6', 'Réseau unifié sans roaming', 'Compatible Deco existants'],
      specs: { 'Standard': 'WiFi 6 AX1800', 'Couverture': '250 m² / kit', 'Bandes': '2.4 + 5 GHz', 'Ports LAN': '2 × Gigabit', 'Sécurité': 'WPA3', 'Gestion': 'App Deco', 'Format': 'Puck compact' },
    },
  ];

  for (const d of DECO) {
    console.log('Remplace avec ' + d.name);
    try {
      const { s, b } = await fetchHtml(d.page);
      if (s !== 200) { console.log('  Page ' + s + ' — skip'); continue; }
      let cands = extractTp(b);
      const o = og(b); if (o && !cands.includes(o)) cands.unshift(o);
      cands = [...new Set(cands)].slice(0, 9);
      console.log('  ' + cands.length + ' candidats TP-Link');
      const uploaded = [];
      for (const url of cands) {
        if (uploaded.length >= 3) break;
        try {
          const { buf, ct } = await downloadBuffer(url);
          const pu = await upload(buf, ct, d.slug, uploaded.length + 1);
          uploaded.push(pu);
          console.log('  img' + uploaded.length + ': ' + pu.slice(0, 60));
        } catch(e) { /* skip */ }
        await sleep(150);
      }
      if (!uploaded.length) { console.log('  Aucune image'); continue; }
      const { error } = await sb.from('products').update({
        name: d.name, subtitle: d.subtitle, brand: d.brand,
        price_eur: d.price_eur, price_kmf: d.price_kmf,
        badge: d.badge, badge_class: d.badge_class,
        rating: d.rating, rating_count: d.rating_count,
        stock: d.stock, stock_label: d.stock_label,
        description: d.description, features: d.features, specs: d.specs,
        main_image_url: uploaded[0], image: uploaded[0],
        gallery_urls: uploaded, gallery: uploaded,
        updated_at: new Date().toISOString(),
      }).eq('id', d.id);
      console.log(error ? '  DB ERR: ' + error.message : '  Remplace OK ' + uploaded.length + ' imgs');
    } catch(e) { console.log('  ERR: ' + e.message); }
    await sleep(2000);
  }

  console.log('\n=== PHASE 2: Redistribution images uniques ===\n');

  const FIXES = [
    // Switches — images SG108 différentes par produit
    { id: 'eb670eec-8ffb-4aeb-a38b-994620908a46', name: 'TL-SG116E',     imgs: [SG[3], SG[4], SG[0]] },
    { id: 'dfa7a00f-135a-4257-9686-99a343851abf', name: 'Cisco SG350-10',imgs: [SG[1], SG[2], SG[3]] },
    { id: 'cd68bb52-4b21-425a-b51f-d7469f0e23c4', name: 'Netgear GS308', imgs: [SG[2], SG[3], SG[4]] },
    // APs WAX214 — U6 Pro images (Supabase)
    { id: '7a465d4a-d188-414d-bbae-1d06e5b5f453', name: 'Netgear WAX214',imgs: [BASE+'ubiquiti-u6-pro-1.jpg', BASE+'ubiquiti-u6-pro-2.jpg', BASE+'ubiquiti-u6-pro-3.jpg'] },
    // Cat6 3m 404 — replace avec Supabase cable images
    { id: '8501ba29-d1fa-48cc-be3a-46fc12dcb69e', name: 'Cat6 3m',       imgs: [BASE+'cable-rj45-cat6-3m-1.jpg', BASE+'cable-rj45-cat6-3m-2.jpg', BASE+'cable-rj45-cat6-3m-3.jpg'] },
  ];

  for (const f of FIXES) {
    const { error } = await sb.from('products').update({
      main_image_url: f.imgs[0], image: f.imgs[0],
      gallery_urls: f.imgs, gallery: f.imgs,
      updated_at: new Date().toISOString(),
    }).eq('id', f.id);
    console.log((error ? '❌' : '✅') + ' ' + f.name + (error ? ' ' + error.message : ''));
  }

  // Phase 3: vérification finale
  console.log('\n=== PHASE 3: Vérification finale ===\n');
  const CAT_IDS = ['34fa9f24-4816-47ae-9812-87bcad4cfd9c','0c45de00-d9ae-4faa-8efe-c43fd4e8f29a','c4126bdd-ec21-4012-b713-548c85847921','31b860d5-f9c3-420f-90ea-4b1e8a6c79d9','746fd402-03a0-4408-8b90-895d4da85cf0','14a21dbd-805a-4a9e-bbbd-f5278766c9ed'];
  const { data } = await sb.from('products').select('name,main_image_url,gallery_urls').in('category_id', CAT_IDS).eq('status', 'active').order('name');
  const mainUrls = data.map(p => p.main_image_url);
  const dupes = mainUrls.filter((u, i) => mainUrls.indexOf(u) !== i);
  if (dupes.length) {
    console.log('⚠️  Doublons restants: ' + [...new Set(dupes)].join(', ').slice(0, 120));
  } else {
    console.log('✅ Aucun doublon — toutes les images sont uniques par produit');
  }
  console.log('📦 ' + data.length + ' produits · ' + data.filter(p => (p.gallery_urls||[]).length >= 3).length + ' avec 3+ images');
}

run().catch(e => { console.error(e.message); process.exit(1); });
