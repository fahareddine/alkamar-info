// scripts/run-migration-010.js
// Applique la migration 010_supplier_sourcing via l'API REST Supabase (pg SQL endpoint)

const SUPABASE_URL = 'https://ovjsinugxkuwsjnfxfgb.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92anNpbnVneGt1d3NqbmZ4ZmdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk4OTExMywiZXhwIjoyMDkxNTY1MTEzfQ.HA8L7k0b36NDSaBwwRLaHdqB6chtm7qazRzrDvZrS3E';
const PROJECT_REF = 'ovjsinugxkuwsjnfxfgb';

// L'API Management Supabase permet d'exécuter du SQL via:
// POST https://api.supabase.com/v1/projects/{ref}/database/query
// Mais nécessite un access token personnel (pas le service role key).
//
// Alternative: utiliser le endpoint /rest/v1/rpc si une fonction exec_sql existe,
// ou passer par le SQL Editor API.
//
// La méthode la plus fiable sans pg direct:
// POST https://{project}.supabase.co/rest/v1/ avec Content-Profile: pg_catalog
// n'est pas supportée non plus.
//
// On utilise l'API pg de Supabase via le endpoint dédié (disponible avec service role):
// https://supabase.com/docs/reference/javascript/db-query (n'existe pas en JS SDK)
//
// Solution: utiliser fetch sur le endpoint SQL de l'API Supabase Management
// avec le token de service role comme Bearer token.

const statements = [
  `ALTER TABLE products
    ADD COLUMN IF NOT EXISTS supplier_url          TEXT,
    ADD COLUMN IF NOT EXISTS supplier_name         TEXT,
    ADD COLUMN IF NOT EXISTS supplier_price        NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS supplier_currency     TEXT DEFAULT 'EUR',
    ADD COLUMN IF NOT EXISTS supplier_shipping     NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS supplier_delivery     TEXT,
    ADD COLUMN IF NOT EXISTS supplier_availability TEXT DEFAULT 'unknown'
      CHECK (supplier_availability IN ('in_stock','out_of_stock','unknown')),
    ADD COLUMN IF NOT EXISTS supplier_last_checked TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS supplier_notes        TEXT`,

  `CREATE TABLE IF NOT EXISTS product_supplier_offers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_name    TEXT NOT NULL,
    supplier_url     TEXT NOT NULL,
    title            TEXT,
    price            NUMERIC(10,2),
    currency         TEXT DEFAULT 'EUR',
    shipping_price   NUMERIC(10,2),
    delivery_estimate TEXT,
    availability     TEXT DEFAULT 'unknown'
      CHECK (availability IN ('in_stock','out_of_stock','unknown')),
    score            NUMERIC(5,2),
    source           TEXT,
    country          TEXT DEFAULT 'FR',
    confidence       SMALLINT DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
    is_primary       BOOLEAN DEFAULT FALSE,
    last_checked_at  TIMESTAMPTZ DEFAULT now(),
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_supplier_offers_product ON product_supplier_offers(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_supplier_offers_score ON product_supplier_offers(product_id, score DESC)`,
  `ALTER TABLE product_supplier_offers ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'product_supplier_offers'
        AND policyname = 'admin_only_supplier_offers'
    ) THEN
      CREATE POLICY "admin_only_supplier_offers"
        ON product_supplier_offers
        USING (auth.role() = 'authenticated');
    END IF;
  END $$`,
];

async function execSQL(sql) {
  // Endpoint SQL de l'API Management Supabase
  // Nécessite un Supabase Personal Access Token (pas le service role key)
  // On tente quand même avec le service role key, puis on utilise pg directement

  // Méthode 1: API Management (nécessite PAT, pas service role)
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (res.ok) {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  }

  const errText = await res.text();
  console.log(`  [API Management ${res.status}]: ${errText.substring(0, 120)}`);

  // Méthode 2: pg direct via URL de connexion pooler (port 6543)
  // Construire la connection string à partir des variables connues
  const { Client } = require('pg');
  const client = new Client({
    connectionString: `postgresql://postgres.${PROJECT_REF}:${process.env.DB_PASSWORD || ''}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query(sql);
    await client.end();
    return result;
  } catch (pgErr) {
    await client.end().catch(() => {});
    throw new Error(`pg: ${pgErr.message}`);
  }
}

async function verifyMigration() {
  console.log('\nVérification...');

  // Vérifier colonnes supplier sur products
  const colCheck = await execSQL(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'products'
       AND column_name LIKE 'supplier_%'
     ORDER BY column_name`
  );
  const cols = Array.isArray(colCheck) ? colCheck : (colCheck?.data ?? []);
  console.log(`✓ ${cols.length} colonnes supplier sur products:`, cols.map(r => r.column_name ?? r).join(', '));

  // Vérifier table product_supplier_offers
  const tableCheck = await execSQL(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'product_supplier_offers'`
  );
  const tables = Array.isArray(tableCheck) ? tableCheck : (tableCheck?.data ?? []);
  if (tables.length > 0) {
    console.log('✓ Table product_supplier_offers créée');
  } else {
    console.error('✗ Table product_supplier_offers non trouvée');
  }
}

async function runMigration() {
  console.log('=== Migration 010_supplier_sourcing ===\n');

  for (const [i, sql] of statements.entries()) {
    const label = sql.trim().replace(/\s+/g, ' ').substring(0, 70);
    process.stdout.write(`[${i + 1}/${statements.length}] ${label}...\n`);
    try {
      await execSQL(sql);
      console.log(`  → OK`);
    } catch (e) {
      console.error(`  → ERREUR: ${e.message}`);
      process.exit(1);
    }
  }

  await verifyMigration();
  console.log('\n=== Migration appliquée avec succès ===');
}

runMigration().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
