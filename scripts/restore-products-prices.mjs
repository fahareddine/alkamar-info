// scripts/restore-products-prices.mjs
// Restaure price_eur / price_kmf / price_old depuis un backup JSON.
// Usage : node scripts/restore-products-prices.mjs backups/products-backup-XXXX.json
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';

config({ path: '.env.local' });

const file = process.argv[2];
if (!file) {
  console.error('Usage : node scripts/restore-products-prices.mjs <fichier-backup.json>');
  process.exit(1);
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function run() {
  const rows = JSON.parse(readFileSync(file, 'utf8'));
  console.log(`Restauration des prix de ${rows.length} produits depuis ${file}…`);
  let ok = 0, errors = 0;
  for (const p of rows) {
    const { error } = await sb
      .from('products')
      .update({
        price_eur: p.price_eur,
        price_kmf: p.price_kmf,
        price_old: p.price_old,
        updated_at: new Date().toISOString(),
      })
      .eq('id', p.id);
    if (error) { errors++; console.error('Erreur', p.id, error.message); }
    else ok++;
  }
  console.log(`Restauré : ${ok} | Erreurs : ${errors}`);
}

run();
