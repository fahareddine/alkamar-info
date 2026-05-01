// scripts/audit-reseau-images.js
// Audit complet images section Réseau — vérifie HTTP chaque URL
// Usage: node scripts/audit-reseau-images.js

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

const RESEAU_CATS = {
  '34fa9f24-4816-47ae-9812-87bcad4cfd9c': 'routeur-wifi',
  '0c45de00-d9ae-4faa-8efe-c43fd4e8f29a': 'routeur-4g5g',
  'c4126bdd-ec21-4012-b713-548c85847921': 'switch',
  '31b860d5-f9c3-420f-90ea-4b1e8a6c79d9': 'point-acces',
  '746fd402-03a0-4408-8b90-895d4da85cf0': 'cable',
  '14a21dbd-805a-4a9e-bbbd-f5278766c9ed': 'essentiel-reseau',
};

const BANNED = ['ldlc.com','/ldlc','ldlc-media','cdiscount.com','fnac.com','darty.com'];

function isBanned(url) {
  return url && BANNED.some(d => url.toLowerCase().includes(d));
}

function checkUrl(url) {
  return new Promise(resolve => {
    if (!url || url.startsWith('data:')) return resolve({ ok: false, status: 0, reason: 'empty/data' });
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }, res => {
        resolve({ ok: res.statusCode < 400, status: res.statusCode, reason: null });
      });
      req.on('error', e => resolve({ ok: false, status: 0, reason: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, reason: 'timeout' }); });
      req.end();
    } catch(e) {
      resolve({ ok: false, status: 0, reason: 'invalid URL: ' + e.message });
    }
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\n🔍 AUDIT IMAGES — Section Réseau\n' + '═'.repeat(70));

  const { data: products, error } = await sb
    .from('products')
    .select('id,legacy_id,name,brand,price_eur,main_image_url,gallery_urls,gallery,status,category_id')
    .in('category_id', Object.keys(RESEAU_CATS))
    .order('name');

  if (error) { console.error('❌ Supabase:', error.message); process.exit(1); }

  console.log(`📦 ${products.length} produits réseau trouvés\n`);

  const report = { ok: [], issues: [] };

  for (const p of products) {
    const cat   = RESEAU_CATS[p.category_id] || '?';
    const main  = p.main_image_url;
    const gall  = p.gallery_urls || p.gallery || [];
    const issues = [];

    // Vérifications statiques
    if (!main)                   issues.push({ sev: 'CRITIQUE', msg: 'main_image_url manquante' });
    else if (isBanned(main))     issues.push({ sev: 'CRITIQUE', msg: 'watermark marchand: ' + main.split('/')[2] });
    else if (main.startsWith('data:')) issues.push({ sev: 'GRAVE', msg: 'data URI (placeholder)' });

    if (gall.length === 0)       issues.push({ sev: 'MINEUR', msg: 'galerie vide' });
    else if (gall.length < 3)    issues.push({ sev: 'INFO', msg: `seulement ${gall.length} image(s) en galerie` });

    const bannedGall = gall.filter(u => isBanned(u));
    if (bannedGall.length)       issues.push({ sev: 'GRAVE', msg: `${bannedGall.length} image(s) galerie avec watermark` });

    // Vérification HTTP image principale
    let httpResult = null;
    if (main && !isBanned(main) && !main.startsWith('data:')) {
      httpResult = await checkUrl(main);
      if (!httpResult.ok) issues.push({ sev: 'CRITIQUE', msg: `image principale inaccessible (HTTP ${httpResult.status}: ${httpResult.reason})` });
      await sleep(200);
    }

    const status = p.status === 'inactive' ? '⏸️ INACTIF' : '🟢';

    if (issues.length === 0) {
      report.ok.push({ id: p.id, name: p.name, cat, imgs: gall.length });
    } else {
      report.issues.push({ id: p.id, legacy_id: p.legacy_id, name: p.name, brand: p.brand,
        price: p.price_eur, cat, status: p.status, main_image_url: main, gallery_count: gall.length,
        issues });
    }

    const issueStr = issues.length
      ? issues.map(i => `[${i.sev}] ${i.msg}`).join(' | ')
      : '✅ OK';
    console.log(`${status} [${cat.padEnd(16)}] ${p.name.slice(0,35).padEnd(35)} ${issueStr}`);
  }

  // ── Rapport ─────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log(`\n📊 RÉSUMÉ`);
  console.log(`  ✅ OK       : ${report.ok.length} produits`);
  console.log(`  ❌ Problèmes: ${report.issues.length} produits\n`);

  if (report.issues.length) {
    console.log('📋 PRODUITS À CORRIGER:');
    console.log('─'.repeat(70));
    report.issues.forEach((p, i) => {
      console.log(`\n${i+1}. ${p.name} (${p.brand}) — €${p.price} [${p.cat}]`);
      console.log(`   ID: ${p.id}`);
      console.log(`   Legacy: ${p.legacy_id || '—'}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Image: ${p.main_image_url?.slice(0,70) || 'NULL'}`);
      console.log(`   Galerie: ${p.gallery_count} image(s)`);
      p.issues.forEach(iss => console.log(`   ${iss.sev === 'CRITIQUE' ? '🚨' : iss.sev === 'GRAVE' ? '⚠️' : 'ℹ️'} ${iss.msg}`));
    });
  }

  console.log('\n' + '═'.repeat(70));
  console.log('\n🎯 ACTIONS RECOMMANDÉES:');
  const critiques = report.issues.filter(p => p.issues.some(i => i.sev === 'CRITIQUE'));
  const graves    = report.issues.filter(p => p.issues.some(i => i.sev === 'GRAVE') && !p.issues.some(i => i.sev === 'CRITIQUE'));
  const mineurs   = report.issues.filter(p => p.issues.every(i => i.sev === 'MINEUR' || i.sev === 'INFO'));

  console.log(`  🚨 Critique (image manquante/cassée): ${critiques.length} → fix immédiat`);
  console.log(`  ⚠️  Grave (watermark/galerie):       ${graves.length} → fix prioritaire`);
  console.log(`  ℹ️  Mineur (galerie incomplète):      ${mineurs.length} → amélioration`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
