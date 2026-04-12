// supabase/seed/migrate_products.js
// Usage: node supabase/seed/migrate_products.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Charger products.js et extraire PRODUCTS
const src = fs.readFileSync(path.join(__dirname, '../../js/products.js'), 'utf8');
const fn = new Function(src + '\nreturn PRODUCTS;');
const PRODUCTS = fn();

// Mapping subcategory → { parent, label, icon, sort }
const SUBCATEGORY_MAP = {
  portables:       { parent: 'ordinateurs', label: 'PC Portables', icon: '💻', sort: 1 },
  bureau:          { parent: 'ordinateurs', label: 'PC de Bureau', icon: '🖥️', sort: 2 },
  gaming:          { parent: 'ordinateurs', label: 'PC Gaming', icon: '🎮', sort: 3 },
  toutunun:        { parent: 'ordinateurs', label: 'PC Tout-en-un', icon: '📺', sort: 4 },
  reconditiones:   { parent: 'ordinateurs', label: 'Reconditionnés Grade A', icon: '♻️', sort: 5 },
  minipc:          { parent: 'ordinateurs', label: 'Mini PC', icon: '📦', sort: 6 },
  cpu:             { parent: 'composants',  label: 'Processeurs CPU', icon: '🔲', sort: 1 },
  cartemere:       { parent: 'composants',  label: 'Cartes mères', icon: '🖥️', sort: 2 },
  ram:             { parent: 'composants',  label: 'RAM / Mémoire', icon: '💾', sort: 3 },
  gpu:             { parent: 'composants',  label: 'Cartes graphiques GPU', icon: '🎮', sort: 4 },
  alimentation:    { parent: 'composants',  label: 'Alimentations', icon: '⚡', sort: 5 },
  boitier:         { parent: 'composants',  label: 'Boîtiers PC', icon: '📦', sort: 6 },
  refroidissement: { parent: 'composants',  label: 'Refroidissement', icon: '❄️', sort: 7 },
  clavier:         { parent: 'peripheriques', label: 'Claviers', icon: '⌨️', sort: 1 },
  souris:          { parent: 'peripheriques', label: 'Souris', icon: '🖱️', sort: 2 },
  casque:          { parent: 'peripheriques', label: 'Casques / Enceintes', icon: '🎧', sort: 3 },
  webcam:          { parent: 'peripheriques', label: 'Webcams', icon: '📷', sort: 4 },
  imprimante:      { parent: 'peripheriques', label: 'Imprimantes', icon: '🖨️', sort: 5 },
  onduleur:        { parent: 'peripheriques', label: 'Onduleurs', icon: '🔋', sort: 6 },
  'routeur-wifi':  { parent: 'reseau', label: 'Routeurs WiFi', icon: '📡', sort: 1 },
  'routeur-4g5g':  { parent: 'reseau', label: 'Routeurs 4G/5G', icon: '📶', sort: 2 },
  switch:          { parent: 'reseau', label: 'Switches', icon: '🔀', sort: 3 },
  'point-acces':   { parent: 'reseau', label: "Points d'accès", icon: '📡', sort: 4 },
  cable:           { parent: 'reseau', label: 'Câbles réseau', icon: '🔌', sort: 5 },
  'ssd-externe':   { parent: 'stockage', label: 'SSD Externes', icon: '💽', sort: 1 },
  'ssd-interne':   { parent: 'stockage', label: 'SSD Internes', icon: '💾', sort: 2 },
  hdd:             { parent: 'stockage', label: 'Disques durs HDD', icon: '🗄️', sort: 3 },
  'cle-usb':       { parent: 'stockage', label: 'Clés USB', icon: '🔑', sort: 4 },
  'carte-memoire': { parent: 'stockage', label: 'Cartes mémoire', icon: '📱', sort: 5 },
  nas:             { parent: 'stockage', label: 'NAS', icon: '🖥️', sort: 6 },
  'ecran-fhd':     { parent: 'ecrans', label: 'Écrans Full HD', icon: '🖥️', sort: 1 },
  'ecran-4k':      { parent: 'ecrans', label: 'Écrans 4K', icon: '🔲', sort: 2 },
  'ecran-gaming':  { parent: 'ecrans', label: 'Écrans Gaming', icon: '🎮', sort: 3 },
  'ecran-reco':    { parent: 'ecrans', label: 'Écrans reconditionnés', icon: '♻️', sort: 4 },
};

const PARENT_CATS = ['ordinateurs', 'composants', 'peripheriques', 'reseau', 'stockage', 'ecrans'];

async function run() {
  console.log(`Chargé ${PRODUCTS.length} produits depuis products.js`);

  // 1. Insérer catégories parentes
  const parentInserts = PARENT_CATS.map((slug, i) => ({
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    slug,
    sort_order: i,
  }));
  const { data: parents, error: pe } = await supabase
    .from('categories').upsert(parentInserts, { onConflict: 'slug' }).select();
  if (pe) { console.error('Erreur catégories parentes:', pe.message); process.exit(1); }
  console.log(`✓ ${parents.length} catégories parentes`);

  const parentMap = Object.fromEntries(parents.map(p => [p.slug, p.id]));

  // 2. Insérer sous-catégories
  const subInserts = Object.entries(SUBCATEGORY_MAP).map(([slug, info]) => ({
    name: info.label, slug, icon: info.icon, sort_order: info.sort,
    parent_id: parentMap[info.parent],
  }));
  const { data: subs, error: se } = await supabase
    .from('categories').upsert(subInserts, { onConflict: 'slug' }).select();
  if (se) { console.error('Erreur sous-catégories:', se.message); process.exit(1); }
  console.log(`✓ ${subs.length} sous-catégories`);

  const subMap = Object.fromEntries(subs.map(s => [s.slug, s.id]));

  // 3. Insérer produits par batch de 50
  const productRows = PRODUCTS.map(p => {
    const gallery = (p.gallery || []).map(item =>
      typeof item === 'string' ? { src: item, alt: '' } : item
    );
    return {
      legacy_id: p.id,
      name: p.name,
      subtitle: p.subtitle || null,
      slug: p.id,
      description: p.description || null,
      price_eur: p.price,
      price_kmf: p.priceKmf,
      price_old: p.priceOld || null,
      stock: p.stock === 'En stock' ? 10 : p.stock === 'Rupture de stock' ? 0 : 5,
      stock_label: typeof p.stock === 'string' ? p.stock : 'En stock',
      status: 'active',
      category_id: subMap[p.subcategory] || null,
      brand: p.brand || null,
      badge: p.badge || null,
      badge_class: p.badgeClass || null,
      rating: p.rating || 0,
      rating_count: p.ratingCount || 0,
      image: p.image || null,
      gallery,
      features: p.features || [],
      specs: p.specs || {},
    };
  });

  let inserted = 0;
  for (let i = 0; i < productRows.length; i += 50) {
    const batch = productRows.slice(i, i + 50);
    const { error: prodErr } = await supabase
      .from('products').upsert(batch, { onConflict: 'legacy_id' });
    if (prodErr) { console.error(`Erreur batch ${i}:`, prodErr.message); process.exit(1); }
    inserted += batch.length;
    console.log(`  → ${inserted}/${productRows.length} produits insérés`);
  }

  console.log(`\n✅ Migration terminée : ${PRODUCTS.length} produits dans Supabase`);
}

run().catch(e => { console.error(e); process.exit(1); });
