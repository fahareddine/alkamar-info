// scripts/test-order-flow.mjs
// Test bout-en-bout PROD : commande invité → order_items insérés + stock décrémenté
// → nettoyage complet (commande supprimée, stock restauré).
import { createRequire } from 'node:module';
import { config } from 'dotenv';
config({ path: '.env.local' });
const require = createRequire(import.meta.url);
const { supabase } = require('../api/_lib/supabase.js');

let failures = 0;
const check = (label, cond) => { console.log((cond ? '  ✔' : '  ✖ ÉCHEC'), label); if (!cond) failures++; };

// 1. Produit cible avec stock
const { data: prod } = await supabase.from('products')
  .select('id, name, stock, stock_label').eq('status', 'active').gt('stock', 3).limit(1).single();
console.log(`── Produit test : ${prod.name} (stock ${prod.stock}, "${prod.stock_label}")`);

// 2. Commande invité via l'API PUBLIQUE de production
const resp = await fetch('https://boutique.info-experts.fr/api/orders?action=guest_checkout', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customer_name: 'TEST AUTONOME (à ignorer)',
    customer_email: 'test-autonome@example.com',
    payment_method: 'cash_pickup',
    cart_items: [{ id: prod.id, qty: 2 }],
  }),
});
const order = await resp.json();
check(`commande créée (HTTP ${resp.status})`, resp.ok && order.order_id);

// 3. Vérifications en base
const { data: items } = await supabase.from('order_items')
  .select('product_id, quantity, unit_price_eur, product_snapshot').eq('order_id', order.order_id);
check(`order_items insérés (${items?.length || 0} ligne)`, items?.length === 1);
check('snapshot produit présent', !!items?.[0]?.product_snapshot?.name);
check('prix unitaire correct', Number(items?.[0]?.unit_price_eur) > 0);

const { data: prodAfter } = await supabase.from('products')
  .select('stock, stock_label').eq('id', prod.id).single();
check(`stock décrémenté (${prod.stock} → ${prodAfter.stock})`, prodAfter.stock === prod.stock - 2);

// 4. Nettoyage complet
await supabase.from('order_items').delete().eq('order_id', order.order_id);
await supabase.from('orders').delete().eq('id', order.order_id);
await supabase.from('customers').delete().eq('email', 'test-autonome@example.com');
await supabase.from('products').update({ stock: prod.stock, stock_label: prod.stock_label }).eq('id', prod.id);
const { data: prodRestored } = await supabase.from('products').select('stock').eq('id', prod.id).single();
check(`nettoyage : stock restauré (${prodRestored.stock})`, prodRestored.stock === prod.stock);

console.log(failures === 0 ? '\n✅ FLUX COMMANDE : TOUT FONCTIONNE' : `\n❌ ${failures} échec(s)`);
process.exit(failures === 0 ? 0 : 1);
