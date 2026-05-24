/**
 * Fix product images: replace placehold.co / Unsplash placeholders
 * with real product images found via Amazon.fr search.
 *
 * Usage: node scripts/fix-product-images.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const SUPABASE_URL = 'https://ovjsinugxkuwsjnfxfgb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92anNpbnVneGt1d3NqbmZ4ZmdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk4OTExMywiZXhwIjoyMDkxNTY1MTEzfQ.HA8L7k0b36NDSaBwwRLaHdqB6chtm7qazRzrDvZrS3E';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// Known good images for specific products (manufacturer CDN URLs will need Supabase proxy)
// Use Amazon.fr search as primary source — m.media-amazon.com is CSP-whitelisted
const MANUAL_OVERRIDES = {
  // Well-known products where Amazon search might be unreliable
};

async function searchAmazonImage(page, productName) {
  try {
    const searchQuery = encodeURIComponent(productName);
    await page.goto(`https://www.amazon.fr/s?k=${searchQuery}&i=computers`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    // Wait for search results
    await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 8000 });

    // Get the first result's image
    const imgSrc = await page.evaluate(() => {
      const results = document.querySelectorAll('[data-component-type="s-search-result"]');
      for (const result of results) {
        // Skip sponsored
        if (result.querySelector('.s-sponsored-label-info-icon')) continue;
        const img = result.querySelector('img.s-image');
        if (img) {
          // Get high-res version by replacing size suffix
          let src = img.src || img.getAttribute('data-src') || '';
          // Replace thumbnail size with larger size
          src = src.replace(/\._AC_U[LS]\d+_/, '._AC_SL500_');
          src = src.replace(/\._AC_AA\d+_/, '._AC_SL500_');
          if (src && src.includes('media-amazon.com')) return src;
        }
      }
      // Fall back to first image found
      const firstImg = document.querySelector('[data-component-type="s-search-result"] img.s-image');
      if (firstImg) {
        let src = firstImg.src || '';
        src = src.replace(/\._AC_U[LS]\d+_/, '._AC_SL500_');
        src = src.replace(/\._AC_AA\d+_/, '._AC_SL500_');
        return src;
      }
      return null;
    });

    return imgSrc || null;
  } catch (e) {
    console.error(`  Amazon search failed for "${productName}": ${e.message}`);
    return null;
  }
}

async function getProductImage(page, productName, slug) {
  if (MANUAL_OVERRIDES[slug]) return MANUAL_OVERRIDES[slug];
  return await searchAmazonImage(page, productName);
}

async function updateProductGallery(id, name, imageUrl) {
  const gallery = [{ src: imageUrl, alt: name }];
  const body = JSON.stringify({ gallery, image: imageUrl });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
    method: 'PATCH',
    headers,
    body
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase PATCH failed: ${res.status} ${txt}`);
  }
  return true;
}

async function main() {
  const products = JSON.parse(readFileSync('fake_products.json', 'utf8'));
  console.log(`Processing ${products.length} fake-image products...\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const results = { fixed: [], failed: [] };

  for (let i = 0; i < products.length; i++) {
    const { id, name, slug } = products[i];
    console.log(`[${i + 1}/${products.length}] ${name}`);

    try {
      const imgUrl = await getProductImage(page, name, slug);
      if (!imgUrl || !imgUrl.includes('media-amazon.com')) {
        console.log(`  ✗ No Amazon image found (got: ${imgUrl || 'null'})`);
        results.failed.push({ id, name, slug, reason: 'no image found' });
        continue;
      }

      await updateProductGallery(id, name, imgUrl);
      console.log(`  ✓ ${imgUrl}`);
      results.fixed.push({ id, name, slug, image: imgUrl });

      // Small delay to be polite to Amazon
      await page.waitForTimeout(800);
    } catch (e) {
      console.error(`  ✗ Error: ${e.message}`);
      results.failed.push({ id, name, slug, reason: e.message });
    }
  }

  await browser.close();

  writeFileSync('reports/image-fix-results.json', JSON.stringify(results, null, 2));

  console.log(`\n═══ RESULTS ═══`);
  console.log(`Fixed:  ${results.fixed.length}/${products.length}`);
  console.log(`Failed: ${results.failed.length}/${products.length}`);

  if (results.failed.length > 0) {
    console.log('\nFailed products:');
    results.failed.forEach(p => console.log(`  - ${p.slug}: ${p.reason}`));
  }

  return results;
}

main().catch(console.error);
