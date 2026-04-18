// scripts/fetch_gallery.js
// Scrape Amazon.fr pour trouver 3 images par produit ordinateur
// Usage: node scripts/fetch_gallery.js

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const SUBCATEGORIES = ['portables', 'bureau', 'gaming', 'toutunun', 'reconditiones', 'minipc'];
const DELAY_MS = 1500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
        ...headers,
      },
    };
    const req = https.get(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractImagesFromPage(html) {
  const images = new Set();

  // Pattern 1: hiRes images in JSON
  const hiResMatches = html.matchAll(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g);
  for (const m of hiResMatches) images.add(m[1].replace(/\._AC_[A-Z0-9]+_/g, ''));

  // Pattern 2: colorImages JSON
  const colorMatches = html.matchAll(/"large":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g);
  for (const m of colorMatches) images.add(m[1].replace(/\._AC_[A-Z0-9]+_/g, ''));

  // Pattern 3: data-old-hires
  const oldHiresMatches = html.matchAll(/data-old-hires="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g);
  for (const m of oldHiresMatches) images.add(m[1].replace(/\._AC_[A-Z0-9]+_/g, ''));

  return [...images].filter(url => url.length > 50).slice(0, 3);
}

async function searchAmazonAsin(brand, name) {
  const query = encodeURIComponent(`site:amazon.fr ${brand} ${name}`);
  const url = `https://html.duckduckgo.com/html/?q=${query}`;
  try {
    const { body } = await fetchUrl(url);
    const asinMatch = body.match(/amazon\.fr\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    return asinMatch ? asinMatch[1] : null;
  } catch (e) {
    return null;
  }
}

async function getProductImages(brand, name, currentImage) {
  const asin = await searchAmazonAsin(brand, name);
  if (!asin) {
    console.log(`  ✗ ASIN non trouvé pour ${brand} ${name}`);
    return null;
  }

  await sleep(DELAY_MS);
  const url = `https://www.amazon.fr/dp/${asin}`;
  try {
    const { body, status } = await fetchUrl(url);
    if (status !== 200) {
      console.log(`  ✗ Page ${asin} status ${status}`);
      return null;
    }
    const images = extractImagesFromPage(body);
    if (images.length === 0) {
      console.log(`  ✗ Aucune image trouvée sur ${asin}`);
      return null;
    }
    // Ensure current main image is first
    if (!images.includes(currentImage) && currentImage) images.unshift(currentImage);
    return images.slice(0, 3);
  } catch (e) {
    console.log(`  ✗ Erreur page ${asin}: ${e.message}`);
    return null;
  }
}

async function run() {
  // Fetch all ordinateurs products from Supabase
  const { data: cats } = await supabase
    .from('categories')
    .select('id, slug')
    .in('slug', SUBCATEGORIES);

  const catIds = cats.map(c => c.id);
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, brand, image, gallery, categories(slug)')
    .in('category_id', catIds)
    .eq('status', 'active');

  if (error) { console.error('Supabase error:', error.message); process.exit(1); }

  console.log(`${products.length} produits à traiter`);
  let updated = 0;
  let failed = 0;

  for (const p of products) {
    const currentGallery = p.gallery || [];
    const gallerySrcs = currentGallery.map(g => typeof g === 'string' ? g : g?.src).filter(Boolean);
    const allAmazon = gallerySrcs.every(s => s.includes('amazon') && !s.includes('placehold.co'));
    const allDistinct = new Set(gallerySrcs).size >= 2;
    const hasRealGallery = gallerySrcs.length >= 3 && allAmazon && allDistinct;

    if (hasRealGallery) {
      console.log(`  ✓ ${p.name} — galerie OK`);
      continue;
    }

    console.log(`Traitement: ${p.brand} ${p.name}`);
    await sleep(DELAY_MS);

    const images = await getProductImages(p.brand, p.name, p.image);
    if (!images || images.length === 0) {
      // Fallback: use main image 3 times
      const fallback = [p.image, p.image, p.image].filter(Boolean);
      if (fallback.length > 0) {
        const gallery = fallback.map(src => ({ src, alt: '' }));
        await supabase.from('products').update({ gallery }).eq('id', p.id);
        console.log(`  → fallback (3x même image)`);
        failed++;
      }
      continue;
    }

    const gallery = images.map(src => ({ src, alt: '' }));
    const { error: updateErr } = await supabase
      .from('products')
      .update({ gallery, image: images[0] })
      .eq('id', p.id);

    if (updateErr) {
      console.log(`  ✗ Update failed: ${updateErr.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${images.length} images → ${images.map(u => u.split('/I/')[1]).join(', ')}`);
      updated++;
    }
  }

  console.log(`\n✅ ${updated} produits mis à jour, ${failed} fallbacks`);
}

run().catch(console.error);
