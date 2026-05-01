// scripts/fix-imprimantes.js — corrige les 2 slugs dupliqués + 2 produits à 2 images
const { chromium } = require('playwright');
const https = require('https');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function dl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' } }, res => {
      if ([301,302,307].includes(res.statusCode) && res.headers.location) return dl(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const ct = res.headers['content-type'] || 'image/jpeg';
      const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve({ buf: Buffer.concat(c), ct }));
    });
    req.on('error', reject); req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}
async function up(buf, ct, slug, n) {
  const ext = ct.includes('png') ? 'png' : 'jpg';
  const p = `imprimantes/${slug}-${n}.${ext}`;
  await sb.storage.from('products').upload(p, buf, { contentType: ct, upsert: true, cacheControl: '31536000' });
  return sb.storage.from('products').getPublicUrl(p).data.publicUrl;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', locale: 'fr-FR' });
  const page = await ctx.newPage();
  try { await page.goto('https://www.amazon.fr', { waitUntil: 'domcontentloaded', timeout: 15000 }); await sleep(1000); await page.locator('#sp-cc-accept').click({ timeout: 2000 }); } catch {}

  async function getImgs(q) {
    try {
      await page.goto('https://www.amazon.fr/s?k=' + encodeURIComponent(q), { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(2000);
      const r = await page.locator('[data-component-type="s-search-result"] a.a-link-normal.s-no-outline').all();
      if (!r.length) return [];
      await r[0].click(); await page.waitForLoadState('domcontentloaded'); await sleep(2500);
      return page.evaluate(() => {
        const s = new Set();
        for (const sc of document.querySelectorAll('script'))
          for (const m of sc.textContent.matchAll(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
            s.add(m[1].replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
        return [...s].slice(0, 5);
      });
    } catch(e) { return []; }
  }

  async function makeProduct(query, slug, data) {
    console.log('\n📦 ' + data.name);
    const imgs = await getImgs(query);
    console.log('  imgs: ' + imgs.length);
    const uploaded = [];
    for (let i = 0; i < imgs.length && uploaded.length < 3; i++) {
      try { const { buf, ct } = await dl(imgs[i]); const u = await up(buf, ct, slug, uploaded.length + 1); uploaded.push(u); } catch {}
    }
    if (!uploaded.length) { console.log('  ❌ No images'); return false; }
    const { error } = await sb.from('products').insert({ ...data, slug, main_image_url: uploaded[0], image: uploaded[0], gallery_urls: uploaded, gallery: uploaded, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    if (error) { console.log('  ❌ ' + error.message); return false; }
    console.log('  ✅ Créé avec ' + uploaded.length + ' images');
    return true;
  }

  // Fix 1: HP DeskJet 2820e
  await makeProduct('HP DeskJet 2820e imprimante jet encre wifi', 'hp-deskjet-2820e-v2', {
    name: 'HP DeskJet 2820e', subtitle: 'Jet encre · WiFi · 3-en-1', brand: 'HP',
    category_id: '0029d2b4-b4bc-4792-97ee-2253b6b701e4', badge: 'Entrée gamme', badge_class: 'badge--deal',
    price_eur: 59.99, price_kmf: 29515, rating: 4, rating_count: 3842, stock: 8, stock_label: 'En stock', status: 'active',
    description: "L'HP DeskJet 2820e est l'imprimante jet d'encre idéale pour la maison. WiFi intégré, recto-verso automatique et compatible HP+. Compacte et facile à installer via l'application HP Smart.",
    features: ['WiFi intégré — impression depuis mobile ou PC','Impression recto-verso automatique','Compatible HP+ — cartouches livrées automatiquement','Scanner à plat 1200 dpi','Configuration via app HP Smart'],
    specs: { 'Technologie': "Jet d'encre thermique", 'Couleur': 'Oui', 'Vitesse (noir)': '8 ppm', 'Résolution': '1200×1200 dpi', 'Connectivité': 'WiFi, USB', 'Scanner': '1200 dpi', 'Format': 'A4', 'Bac': '60 feuilles', 'Cartouches': '305 / 305XL', 'Recto-verso': 'Automatique', 'Poids': '4,98 kg', 'OS': 'Windows, macOS', 'Garantie': '1 an', 'HP+': 'Oui', 'AirPrint': 'Oui' },
  });
  await sleep(3000);

  // Fix 2: Canon PIXMA TS3550i
  await makeProduct('Canon PIXMA TS3550i imprimante jet encre wifi', 'canon-pixma-ts3550i-v2', {
    name: 'Canon PIXMA TS3550i', subtitle: 'Jet encre · WiFi · FINE', brand: 'Canon',
    category_id: '0029d2b4-b4bc-4792-97ee-2253b6b701e4', badge: 'Best seller', badge_class: 'badge--best',
    price_eur: 79.99, price_kmf: 39355, rating: 4, rating_count: 4521, stock: 12, stock_label: 'En stock', status: 'active',
    description: "Le Canon PIXMA TS3550i est une imprimante jet d'encre multifonction WiFi pour toute la famille. Technologie FINE, compatible AirPrint et Mopria pour imprimer depuis smartphone ou ordinateur.",
    features: ['PIXMA Print Plan — abonnement cartouches auto','AirPrint + Mopria — impression mobile','Technologie FINE — textes nets, photos éclatantes','Copie directe sans PC','Interface intuitive'],
    specs: { 'Technologie': 'Jet encre FINE', 'Couleur': 'Oui', 'Vitesse': '8 ipm', 'Résolution': '4800×1200 dpi', 'WiFi': 'Oui + Direct', 'Scanner': '1200×1200 dpi', 'Format': 'A4', 'Bac': '60 feuilles', 'Cartouches': 'PG-560 / CL-561', 'Recto-verso': 'Manuel', 'Poids': '4,4 kg', 'AirPrint': 'Oui', 'Mopria': 'Oui', 'Garantie': '1 an', 'Eco mode': 'Oui' },
  });
  await sleep(3000);

  // Fix 3: Produits à 2 images — ajoute 3ème
  const to_fix = [
    { slug: 'canon-pixma-ts8351a', query: 'Canon PIXMA TS8351a multifonction photo' },
    { slug: 'lexmark-b2236dw', query: 'Lexmark B2236dw imprimante laser recto verso' },
  ];
  for (const f of to_fix) {
    console.log('\n🔧 Fix images: ' + f.slug);
    const { data } = await sb.from('products').select('id,gallery_urls').eq('slug', f.slug).single();
    if (!data) { console.log('  NOT FOUND'); continue; }
    if ((data.gallery_urls || []).length >= 3) { console.log('  Already 3+'); continue; }
    const imgs = await getImgs(f.query);
    if (!imgs.length) { console.log('  No imgs found'); continue; }
    try {
      const idx = Math.min(2, imgs.length - 1);
      const { buf, ct } = await dl(imgs[idx]);
      const url = await up(buf, ct, f.slug, 3);
      const newGallery = [...(data.gallery_urls || []), url];
      await sb.from('products').update({ gallery_urls: newGallery, gallery: newGallery, updated_at: new Date().toISOString() }).eq('id', data.id);
      console.log('  ✅ ' + f.slug + ' → ' + newGallery.length + ' images');
    } catch(e) { console.log('  ERR: ' + e.message); }
    await sleep(3000);
  }

  await browser.close();
  console.log('\n✅ Done');
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
