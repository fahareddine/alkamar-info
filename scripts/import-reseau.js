#!/usr/bin/env node
// scripts/import-reseau.js
// Import produits réseau depuis un fichier JSON → Supabase
// Usage: node scripts/import-reseau.js [fichier.json]
// Par défaut: lit reseau-products.json dans le même dossier

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || require('../.env.local').SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Charge les vars d'env depuis .env.local si pas en env
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
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Slugs réseau → IDs en DB (mis à jour depuis votre projet)
const SUBCATEGORY_SLUGS = [
  'routeur-wifi',
  'routeur-4g5g',
  'switch',
  'point-acces',
  'cable',
  'essentiel-reseau',
];

async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug')
    .in('slug', SUBCATEGORY_SLUGS);
  if (error) throw new Error('Erreur lecture catégories: ' + error.message);
  const map = {};
  data.forEach(c => { map[c.slug] = c.id; });
  return map;
}

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
      name:        p.name,
      slug,
      brand:       p.brand || null,
      subtitle:    p.subtitle || null,
      description: p.description || null,
      category_id: catId,
      price_eur:   priceEur,
      price_kmf:   priceKmf,
      price_old:   Number(p.price_old) || null,
      rating:      Number(p.rating) || null,
      rating_count: Number(p.rating_count) || 0,
      image:       p.image || null,
      main_image_url: p.main_image_url || null,
      gallery_urls: p.gallery || [],
      features:    p.features || [],
      specs:       p.specs || {},
      stock:       Number(p.stock) ?? 10,
      stock_label: p.stock_label || 'En stock',
      badge:       p.badge || null,
      badge_class: p.badge_class || null,
      status:      p.status || 'draft',
    };

    const { error } = await supabase.from('products').insert(row);
    if (error) {
      if (error.code === '23505') {
        console.log(`↩ Doublon slug: ${slug} — ignoré`);
        skip++;
      } else {
        console.error(`✗ Erreur "${p.name}": ${error.message}`);
        fail++;
      }
    } else {
      console.log(`✓ ${p.name} → ${p.subcategory}`);
      ok++;
    }
  }

  console.log(`\nRésultat: ${ok} importés, ${skip} ignorés, ${fail} erreurs`);
}

async function main() {
  const file = process.argv[2] || path.join(__dirname, 'reseau-products.json');
  if (!fs.existsSync(file)) {
    console.error(`Fichier non trouvé: ${file}`);
    console.log('Créez un fichier JSON avec le format de reseau-products-template.json');
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(products)) {
    console.error('Le fichier doit contenir un tableau JSON de produits');
    process.exit(1);
  }

  console.log(`Import de ${products.length} produits…\n`);
  const catMap = await getCategories();
  console.log('Catégories trouvées:', Object.keys(catMap).join(', '), '\n');
  await importProducts(products, catMap);
}

main().catch(e => { console.error(e); process.exit(1); });
