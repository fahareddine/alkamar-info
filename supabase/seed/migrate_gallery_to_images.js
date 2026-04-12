// supabase/seed/migrate_gallery_to_images.js
// One-shot : migre le JSONB gallery de products vers product_images
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, image, gallery')
    .not('gallery', 'eq', '[]');

  if (error) { console.error('Fetch error:', error.message); process.exit(1); }

  console.log(`Produits avec gallery non vide : ${products.length}`);

  let inserted = 0;
  for (const product of products) {
    const images = [];

    // Image principale
    if (product.image) {
      images.push({
        product_id: product.id,
        src: product.image,
        alt: '',
        sort_order: 0,
        is_primary: true
      });
    }

    // Images galerie
    const gallery = Array.isArray(product.gallery) ? product.gallery : [];
    gallery.forEach((img, idx) => {
      if (img && img.src) {
        images.push({
          product_id: product.id,
          src: img.src,
          alt: img.alt || '',
          sort_order: idx + 1,
          is_primary: false
        });
      }
    });

    if (images.length > 0) {
      const { error: insertError } = await supabase
        .from('product_images')
        .upsert(images, { onConflict: 'product_id,src', ignoreDuplicates: true });
      if (insertError) {
        console.error(`Erreur produit ${product.id}:`, insertError.message);
      } else {
        inserted += images.length;
      }
    }
  }

  console.log(`Images insérées : ${inserted}`);
}

run();
