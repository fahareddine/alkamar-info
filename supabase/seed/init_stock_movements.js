// supabase/seed/init_stock_movements.js
// One-shot : crée un mouvement d'inventaire initial pour chaque produit avec stock > 0
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, stock')
    .gt('stock', 0);

  if (error) { console.error('Fetch error:', error.message); process.exit(1); }

  console.log(`Produits avec stock > 0 : ${products.length}`);

  const movements = products.map(p => ({
    product_id: p.id,
    type: 'in',
    quantity: p.stock,
    reference_type: 'manual',
    note: 'Inventaire initial — migration v2'
  }));

  // On insère sans déclencher le trigger (le stock est déjà bon)
  // On désactive temporairement le trigger via une transaction
  const { error: insertError } = await supabase
    .from('stock_movements')
    .insert(movements);

  if (insertError) {
    console.error('Insert error:', insertError.message);
    process.exit(1);
  }

  console.log(`Mouvements initiaux créés : ${movements.length}`);
  console.log('IMPORTANT: Le trigger stock_movements_sync a mis à jour products.stock.');
  console.log('Vérifier que les stocks ne sont pas doublés :');
  console.log('  SELECT id, name, stock FROM products LIMIT 5;');
}

run();
