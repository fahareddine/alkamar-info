// scripts/backup-products.mjs
// Point de restauration : exporte la table products complète vers backups/
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync, mkdirSync } from 'node:fs';

config({ path: '.env.local' });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PAGE_SIZE = 200;

async function run() {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from('products')
      .select('*')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error('Erreur export:', error.message);
      process.exit(1);
    }
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  mkdirSync('backups', { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const file = `backups/products-backup-${stamp}.json`;
  writeFileSync(file, JSON.stringify(rows, null, 1));
  console.log(`Backup OK : ${rows.length} produits → ${file}`);
}

run();
