// scripts/run-migration.mjs
// Applique un fichier de migration SQL via SUPABASE_DB_URL.
// Usage : node scripts/run-migration.mjs supabase/migrations/016_reviews_stock_alerts.sql
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import pg from 'pg';

config({ path: '.env.local' });

const file = process.argv[2];
if (!file) {
  console.error('Usage : node scripts/run-migration.mjs <fichier.sql>');
  process.exit(1);
}
if (!process.env.SUPABASE_DB_URL) {
  console.error('SUPABASE_DB_URL manquante dans .env.local');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(readFileSync(file, 'utf8'));
  console.log(`Migration OK : ${file}`);
} catch (err) {
  console.error('Erreur migration :', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
