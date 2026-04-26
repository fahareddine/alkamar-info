#!/usr/bin/env node
// scripts/import-essentiel-periph.js
// Crée catégorie essentiel-periph + importe 5 produits
// Usage: node scripts/import-essentiel-periph.js

const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

function loadEnv() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
    raw.split('\n').forEach(l => { const [k,...v]=l.split('='); if(k&&v.length) process.env[k.trim()]=v.join('=').trim(); });
  } catch {}
}
loadEnv();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function slugify(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

async function main() {
  // Trouver/créer parent "Périphériques"
  let { data: parent } = await supabase.from('categories').select('id').eq('slug','peripheriques').maybeSingle();
  if (!parent) {
    const { data } = await supabase.from('categories').insert({ slug:'peripheriques', name:'Périphériques', icon:'🖱️', sort_order:5 }).select('id').single();
    parent = data;
    console.log('✓ Parent créé: Périphériques');
  }

  // Créer essentiel-periph si absent
  let { data: cat } = await supabase.from('categories').select('id').eq('slug','essentiel-periph').maybeSingle();
  if (!cat) {
    const { data, error } = await supabase.from('categories').insert({
      slug: 'essentiel-periph', name: 'Essentiels', icon: '🖥️',
      parent_id: parent.id, sort_order: 25
    }).select('id').single();
    if (error) { console.error('Erreur catégorie:', error.message); process.exit(1); }
    cat = data;
    console.log('✓ Catégorie créée: essentiel-periph');
  } else {
    console.log('✓ Catégorie OK: essentiel-periph (id:', cat.id+')');
  }

  const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'essentiel-periph-products.json'), 'utf8'));
  let ok=0, skip=0, fail=0;

  for (const p of products) {
    const { data: existing } = await supabase.from('products').select('id').eq('slug', p.slug).maybeSingle();
    if (existing) { console.log('↩ Doublon:', p.slug); skip++; continue; }

    const row = {
      name: p.name, slug: p.slug, brand: p.brand, subtitle: p.subtitle,
      description: p.description, category_id: cat.id,
      price_eur: Number(p.price_eur)||0, price_kmf: Number(p.price_kmf)||0,
      price_old: Number(p.price_old)||null,
      rating: Number(p.rating)||null, rating_count: Number(p.rating_count)||0,
      image: p.image||null, main_image_url: p.main_image_url||null,
      gallery_urls: [], features: p.features||[], specs: p.specs||{},
      stock: Number(p.stock)||10, stock_label: p.stock_label||'En stock',
      badge: p.badge||null, badge_class: p.badge_class||null, status: 'active',
    };

    const { error } = await supabase.from('products').insert(row);
    if (error) { console.error('✗', p.name, error.message); fail++; }
    else { console.log('✓', p.name); ok++; }
  }
  console.log(`\n${ok} importés, ${skip} doublons, ${fail} erreurs`);
}

main().catch(e => { console.error(e); process.exit(1); });
