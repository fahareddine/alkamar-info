#!/usr/bin/env node
// scripts/update-ecrans.js
// Met à jour les 5 moniteurs existants avec données complètes (specs, features, description, badge...)
// Usage: node scripts/update-ecrans.js

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

async function main() {
  const file = path.join(__dirname, 'ecrans-products.json');
  const products = JSON.parse(fs.readFileSync(file, 'utf8'));

  console.log(`Mise à jour de ${products.length} moniteurs…\n`);
  let ok = 0, fail = 0;

  for (const p of products) {
    // Trouver l'ID existant par slug
    const { data: existing, error: findErr } = await supabase
      .from('products')
      .select('id, name, status')
      .eq('slug', p.slug)
      .maybeSingle();

    if (findErr) { console.error(`✗ Recherche ${p.slug}: ${findErr.message}`); fail++; continue; }
    if (!existing) { console.log(`⚠ Slug "${p.slug}" non trouvé en DB`); fail++; continue; }

    const updates = {
      subtitle:    p.subtitle,
      description: p.description,
      features:    p.features || [],
      specs:       p.specs || {},
      badge:       p.badge || null,
      badge_class: p.badge_class || null,
      price_eur:   Number(p.price_eur) || 0,
      price_kmf:   Number(p.price_kmf) || Math.round((Number(p.price_eur) || 0) * 492),
      price_old:   Number(p.price_old) || null,
      rating:      Number(p.rating) || null,
      rating_count: Number(p.rating_count) || 0,
      stock_label: p.stock_label || 'En stock',
      status:      'active',
    };

    // Ne pas écraser image si déjà une image Amazon réelle
    if (p.image && (existing.image || '').includes('placehold')) {
      updates.image = p.image;
      updates.main_image_url = p.main_image_url || p.image;
    }

    const { error: updateErr } = await supabase
      .from('products')
      .update(updates)
      .eq('id', existing.id);

    if (updateErr) {
      console.error(`✗ Update "${existing.name}": ${updateErr.message}`);
      fail++;
    } else {
      console.log(`✓ ${existing.name} (${existing.id.slice(0, 8)}…) mis à jour`);
      ok++;
    }
  }

  console.log(`\nRésultat: ${ok} mis à jour, ${fail} erreur(s)`);
  if (ok > 0) console.log('\nÉtape suivante : node scripts/fetch_gallery_ecrans.js');
}

main().catch(e => { console.error(e); process.exit(1); });
