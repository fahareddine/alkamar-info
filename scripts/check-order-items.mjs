// scripts/check-order-items.mjs — diagnostic colonnes order_items
import { config } from 'dotenv';
import pg from 'pg';
config({ path: '.env.local' });

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(
  "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='order_items' ORDER BY ordinal_position"
);
console.log(r.rows.map(x => `${x.column_name} (${x.data_type}, null:${x.is_nullable})`).join('\n'));
await c.end();
