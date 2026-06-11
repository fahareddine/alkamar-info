// scripts/apply-discount-30.mjs
// Réduction silencieuse de 30% sur tous les produits actifs avec prix.
// - price_eur × 0.70 (arrondi 2 décimales)
// - price_kmf × 0.70 (arrondi à la centaine)
// - price_old × 0.70 si présent (garde le même % promo affiché → réduction invisible)
// - Historique dans product_price_history (source: bulk_discount_30)
// Usage : node scripts/apply-discount-30.mjs [--dry-run]
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');
const FACTOR = 0.70;

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const roundEur = (v) => Math.round(v * FACTOR * 100) / 100;
const roundKmf = (v) => Math.round((v * FACTOR) / 100) * 100;

async function run() {
  const { data: products, error } = await sb
    .from('products')
    .select('id, name, status, price_eur, price_kmf, price_old')
    .eq('status', 'active')
    .gt('price_eur', 0)
    .order('name');
  if (error) { console.error('Erreur lecture:', error.message); process.exit(1); }

  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Produits actifs avec prix : ${products.length}\n`);

  let updated = 0, errors = 0;
  for (const p of products) {
    const newEur = roundEur(p.price_eur);
    const newKmf = p.price_kmf > 0 ? roundKmf(p.price_kmf) : p.price_kmf;
    const newOld = p.price_old > 0 ? roundEur(p.price_old) : p.price_old;

    if (DRY_RUN) {
      console.log(`${p.price_eur}€ → ${newEur}€ | ${p.price_kmf || '-'} → ${newKmf || '-'} KMF${p.price_old > 0 ? ` | old ${p.price_old} → ${newOld}` : ''} | ${p.name.slice(0, 45)}`);
      continue;
    }

    const { error: upErr } = await sb
      .from('products')
      .update({
        price_eur: newEur,
        price_kmf: newKmf,
        price_old: newOld,
        updated_at: new Date().toISOString(),
      })
      .eq('id', p.id);

    if (upErr) { errors++; console.error('Erreur', p.id, upErr.message); continue; }

    await sb.from('product_price_history').insert({
      product_id: p.id,
      old_price_eur: p.price_eur,
      old_price_kmf: p.price_kmf,
      new_price_eur: newEur,
      new_price_kmf: newKmf,
      source: 'bulk_discount_30',
      pricing_notes: 'Réduction silencieuse -30% (2026-06-12)',
    });

    updated++;
    if (updated % 50 === 0) console.log(`… ${updated}/${products.length}`);
  }

  console.log(`\n${DRY_RUN ? '[DRY-RUN] aucun changement appliqué' : `Mis à jour : ${updated} | Erreurs : ${errors}`}`);
}

run();
