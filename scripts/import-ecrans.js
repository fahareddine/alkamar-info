#!/usr/bin/env node
// scripts/import-ecrans.js
// Import 5 moniteurs écrans → Supabase (crée les catégories si besoin)
// Usage: node scripts/import-ecrans.js [fichier.json]

const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

function loadEnv() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
    raw.split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    });
  } catch {}
}
loadEnv();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ECRAN_CATEGORIES = [
  { slug: 'ecran-fhd',    name: 'Écrans Full HD',         icon: '🖥️', sort: 10 },
  { slug: 'ecran-4k',     name: 'Écrans 4K UHD',          icon: '✨', sort: 11 },
  { slug: 'ecran-gaming', name: 'Écrans Gaming',           icon: '🎮', sort: 12 },
  { slug: 'ecran-reco',   name: 'Écrans Reconditionnés',   icon: '♻️', sort: 13 },
];
const PARENT_SLUG = 'ecrans';

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function ensureCategories() {
  // Parent "Écrans"
  let { data: parent } = await supabase
    .from('categories').select('id').eq('slug', PARENT_SLUG).maybeSingle();
  if (!parent) {
    const { data, error } = await supabase.from('categories')
      .insert({ slug: PARENT_SLUG, name: 'Écrans & Moniteurs', icon: '🖥️', sort_order: 4 })
      .select('id').single();
    if (error) throw new Error('Création parent écrans: ' + error.message);
    parent = data;
    console.log('✓ Catégorie parent créée: Écrans & Moniteurs');
  } else {
    console.log('✓ Catégorie parent OK: Écrans & Moniteurs');
  }

  const catMap = {};
  for (const cat of ECRAN_CATEGORIES) {
    let { data: existing } = await supabase
      .from('categories').select('id').eq('slug', cat.slug).maybeSingle();
    if (!existing) {
      const { data, error } = await supabase.from('categories')
        .insert({ slug: cat.slug, name: cat.name, icon: cat.icon, parent_id: parent.id, sort_order: cat.sort })
        .select('id').single();
      if (error) throw new Error(`Création catégorie ${cat.slug}: ` + error.message);
      existing = data;
      console.log(`✓ Catégorie créée: ${cat.name}`);
    } else {
      console.log(`✓ Catégorie OK: ${cat.name}`);
    }
    catMap[cat.slug] = existing.id;
  }
  return catMap;
}

async function importProducts(products, catMap) {
  let ok = 0, skip = 0, fail = 0;

  for (const p of products) {
    const catId = catMap[p.subcategory];
    if (!catId) {
      console.warn(`⚠ Sous-catégorie inconnue: "${p.subcategory}" pour "${p.name}" — ignoré`);
      skip++;
      continue;
    }

    const slug = p.slug || slugify(p.name) + '-' + Date.now().toString(36);
    const priceEur = Number(p.price_eur) || 0;
    const priceKmf = Number(p.price_kmf) || Math.round(priceEur * 492);

    const row = {
      name:         p.name,
      slug,
      brand:        p.brand || null,
      subtitle:     p.subtitle || null,
      description:  p.description || null,
      category_id:  catId,
      price_eur:    priceEur,
      price_kmf:    priceKmf,
      price_old:    Number(p.price_old) || null,
      rating:       Number(p.rating) || null,
      rating_count: Number(p.rating_count) || 0,
      image:        p.image || null,
      main_image_url: p.main_image_url || null,
      gallery_urls: Array.isArray(p.gallery) ? p.gallery : [],
      features:     p.features || [],
      specs:        p.specs || {},
      stock:        Number(p.stock) ?? 10,
      stock_label:  p.stock_label || 'En stock',
      badge:        p.badge || null,
      badge_class:  p.badge_class || null,
      status:       p.status || 'draft',
    };

    // Vérifier doublon slug
    const { data: existing } = await supabase
      .from('products').select('id, name').eq('slug', slug).maybeSingle();
    if (existing) {
      console.log(`↩ Doublon slug "${slug}" (${existing.name}) — ignoré`);
      skip++;
      continue;
    }

    const { error } = await supabase.from('products').insert(row);
    if (error) {
      console.error(`✗ Erreur "${p.name}": ${error.message}`);
      fail++;
    } else {
      console.log(`✓ ${p.name} → ${p.subcategory}`);
      ok++;
    }
  }

  console.log(`\nRésultat: ${ok} importés, ${skip} ignorés, ${fail} erreurs`);
}

async function main() {
  const file = process.argv[2] || path.join(__dirname, 'ecrans-products.json');
  if (!fs.existsSync(file)) {
    console.error(`Fichier non trouvé: ${file}`);
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(products)) {
    console.error('Le fichier doit contenir un tableau JSON de produits');
    process.exit(1);
  }

  console.log(`Import de ${products.length} produits écrans…\n`);
  const catMap = await ensureCategories();
  console.log('\nCatégories disponibles:', Object.keys(catMap).join(', '), '\n');
  await importProducts(products, catMap);
  console.log('\nÉtape suivante : node scripts/fetch_gallery_ecrans.js');
}

main().catch(e => { console.error(e); process.exit(1); });
