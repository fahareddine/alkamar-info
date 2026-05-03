// assign-badges.js — Assigne un badge cohérent à chaque produit sans badge
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  'https://ovjsinugxkuwsjnfxfgb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92anNpbnVneGt1d3NqbmZ4ZmdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk4OTExMywiZXhwIjoyMDkxNTY1MTEzfQ.HA8L7k0b36NDSaBwwRLaHdqB6chtm7qazRzrDvZrS3E',
  { auth: { persistSession: false } }
);

function assignBadge(p) {
  const name  = (p.name  || '').toLowerCase();
  const brand = (p.brand || '').toLowerCase();
  const price = Number(p.price_eur) || 0;
  const old   = Number(p.price_old) || 0;
  const rating = Number(p.rating)  || 0;
  const count  = Number(p.rating_count) || 0;
  const stock  = Number(p.stock) ?? 99;

  // 1. Promo — réduction active ET pas déjà géré par catalog.js (price_old présent)
  if (old > 0 && price < old) {
    return { badge: 'Promo', badge_class: 'badge--promo' };
  }

  // 2. Stock limité
  if (stock > 0 && stock <= 5) {
    return { badge: 'Stock limité', badge_class: 'badge--stock' };
  }

  // 3. Bestseller — très noté + beaucoup d'avis
  if (rating >= 4.6 && count >= 2500) {
    return { badge: 'Bestseller', badge_class: 'badge--best' };
  }

  // 4. Gaming — produits gaming
  const gamingKeywords = ['gaming', 'game', 'rgb', 'mécanique', 'mecanique',
    'gamer', 'fps', 'esport', 'keychron', 'hyperx', 'razer', 'steelseries'];
  const gamingBrands = ['msi', 'asus rog', 'corsair', 'hyperx', 'razer',
    'steelseries', 'logitech g', 'rog', 'alienware'];
  if (gamingKeywords.some(k => name.includes(k)) ||
      gamingBrands.some(b => brand.includes(b) || name.includes(b))) {
    return { badge: 'Gaming', badge_class: 'badge--gaming' };
  }

  // 5. Populaire — bien noté avec nombreux avis
  if (rating >= 4.4 && count >= 1500) {
    return { badge: 'Populaire', badge_class: 'badge--popular' };
  }
  if (rating >= 4.5 && count >= 500) {
    return { badge: 'Populaire', badge_class: 'badge--popular' };
  }

  // 6. Bon prix — produit abordable bien noté
  if (price <= 15 && rating >= 4.0) {
    return { badge: 'Bon prix', badge_class: 'badge--deal' };
  }

  // 7. NAS / Serveur / Entreprise
  const nasKeywords = ['nas', 'qnap', 'synology', 'serveur', 'server', 'rack'];
  if (nasKeywords.some(k => name.includes(k) || brand.includes(k))) {
    return { badge: 'Pro', badge_class: 'badge--exclusive' };
  }

  // 8. Mini PC
  if (name.includes('nuc') || name.includes('mini pc') || name.includes('mini-pc')) {
    return { badge: 'Compact', badge_class: 'badge--exclusive' };
  }

  // 9. Nouveau (fallback)
  return { badge: 'Nouveau', badge_class: 'badge--new' };
}

async function run() {
  // Fetch tous les produits sans badge
  const { data: products, error } = await sb
    .from('products')
    .select('id, name, brand, price_eur, price_old, rating, rating_count, stock, badge')
    .or('badge.is.null,badge.eq.')
    .eq('status', 'active');

  if (error) { console.error('Fetch error:', error); process.exit(1); }
  console.log(`Produits sans badge: ${products.length}`);

  let updated = 0, failed = 0;
  for (const p of products) {
    const { badge, badge_class } = assignBadge(p);
    const { error: upErr } = await sb
      .from('products')
      .update({ badge, badge_class })
      .eq('id', p.id);
    if (upErr) {
      console.error(`FAILED ${p.name}: ${upErr.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${badge_class.padEnd(16)} ${p.name}`);
      updated++;
    }
  }
  console.log(`\nDone: ${updated} updated, ${failed} failed`);
}

run();
