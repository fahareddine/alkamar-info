// scripts/set-asins.js — Remplit specs._asin pour les produits actifs
// Usage: node scripts/set-asins.js [--dry-run]
// Stratégie : ASIN connu dans asins.json ou asins_found.json (par slug) → update direct
// Pour renseigner les ASINs manquants, ouvrir scripts/asin-helper.html dans un navigateur

const fs    = require('fs');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const ASINS_FILE      = path.join(__dirname, 'asins.json');
const ASINS_FOUND_FILE = path.join(__dirname, 'asins_found.json');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Charger asins.json (flat slug→asin) ───────────────────────────────────────

function loadAsins() {
  try {
    const raw = JSON.parse(fs.readFileSync(ASINS_FILE, 'utf8'));
    const flat = {};
    for (const cat of Object.values(raw)) {
      if (typeof cat === 'object') {
        for (const [slug, asin] of Object.entries(cat)) {
          if (asin) flat[slug] = asin;
        }
      }
    }
    return flat;
  } catch { return {}; }
}

function loadFoundAsins() {
  try { return JSON.parse(fs.readFileSync(ASINS_FOUND_FILE, 'utf8')); } catch { return {}; }
}

// ── Sauvegarder un ASIN découvert ─────────────────────────────────────────────

function saveFoundAsin(slug, asin, found) {
  found[slug] = asin;
  fs.writeFileSync(ASINS_FOUND_FILE, JSON.stringify(found, null, 2));
}

// ── Update Supabase ───────────────────────────────────────────────────────────

async function setAsin(product, asin) {
  if (DRY_RUN) { console.log(`    [DRY-RUN] specs._asin = ${asin}`); return true; }
  const currentSpecs = product.specs || {};
  const newSpecs = { ...currentSpecs, _asin: asin };
  const { error } = await supabase
    .from('products')
    .update({ specs: newSpecs })
    .eq('id', product.id);
  if (error) { console.log(`    ✗ Update: ${error.message}`); return false; }
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  if (DRY_RUN) console.log('⚠️  DRY-RUN — aucune écriture Supabase\n');

  const knownAsins  = loadAsins();
  const foundAsins  = loadFoundAsins();
  const allKnown    = { ...knownAsins, ...foundAsins };

  console.log(`${Object.keys(allKnown).length} ASINs en cache (asins.json + asins_found.json)\n`);

  // Récupérer tous les produits actifs sans specs._asin
  const { data: products, error } = await supabase
    .from('products')
    .select('id, slug, name, brand, specs')
    .eq('status', 'active')
    .order('name');

  if (error) { console.error('Supabase:', error.message); process.exit(1); }

  const needs = products.filter(p => !p.specs?._asin);
  const alreadySet = products.length - needs.length;

  console.log(`Produits actifs : ${products.length}`);
  console.log(`Déjà avec ASIN  : ${alreadySet}`);
  console.log(`À traiter       : ${needs.length}\n`);

  let updated = 0, failed = 0;

  for (const p of needs) {
    console.log(`→ [${p.slug}] ${p.name}`);

    // Cache (asins.json + asins_found.json)
    const asin = allKnown[p.slug] || null;

    if (!asin) {
      console.log(`  ✗ ASIN manquant (renseigner dans asin-helper.html)`);
      failed++;
      continue;
    }

    console.log(`  ASIN: ${asin}`);
    const ok = await setAsin(p, asin);
    if (ok) {
      updated++;
      console.log(`  ✓ specs._asin mis à jour`);
    } else {
      failed++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ ${updated} mis à jour`);
  console.log(`❌ ${failed} sans ASIN (compléter via asin-helper.html)`);
  console.log(`⏭  ${alreadySet} déjà renseignés`);
}

run().catch(console.error);
