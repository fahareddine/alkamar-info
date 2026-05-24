/**
 * Expand Amazon CDN single-photo products.
 * Strategy: search Amazon.fr, get 3 images from first 3 results for the same query.
 * This avoids clicking through to product pages (which triggers bot detection).
 *
 * Usage: node scripts/expand-amazon-galleries.mjs
 * Optionally: node scripts/expand-amazon-galleries.mjs 0 20   (batch: start=0, count=20)
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const SUPABASE_URL = 'https://ovjsinugxkuwsjnfxfgb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92anNpbnVneGt1d3NqbmZ4ZmdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk4OTExMywiZXhwIjoyMDkxNTY1MTEzfQ.HA8L7k0b36NDSaBwwRLaHdqB6chtm7qazRzrDvZrS3E';

const patchHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getImagesFromSearch(browser, productName) {
  // Fresh context per request to avoid session fingerprinting
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'fr-FR',
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' }
  });
  const page = await context.newPage();

  try {
    const q = encodeURIComponent(productName);
    const resp = await page.goto(`https://www.amazon.fr/s?k=${q}`, {
      waitUntil: 'networkidle', timeout: 20000
    });

    if (!resp || resp.status() !== 200) {
      await context.close();
      return null;
    }

    // Wait a bit for lazy images to load
    await sleep(1500);

    const images = await page.evaluate(() => {
      const seen = new Set();
      const results = [];

      function normalize(src) {
        if (!src || !src.includes('media-amazon.com')) return null;
        return src
          .replace(/\._AC_U[YSL]+\d+_/g, '._AC_SL500_')
          .replace(/\._AC_AA\d+_/g, '._AC_SL500_')
          .replace(/\._SX\d+_/g, '._AC_SL500_')
          .replace(/\._SY\d+_/g, '._AC_SL500_')
          .replace(/\._AC_SL500__AC_SL500_/g, '._AC_SL500_');
      }

      // Get images from first 4 non-sponsored results
      const items = Array.from(document.querySelectorAll('[data-component-type="s-search-result"]'))
        .filter(r => !r.querySelector('.s-sponsored-label-info-icon'))
        .slice(0, 4);

      for (const item of items) {
        const img = item.querySelector('img.s-image');
        if (!img) continue;
        const norm = normalize(img.src || img.getAttribute('data-src') || '');
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          results.push(norm);
        }
      }

      return results;
    });

    await context.close();
    return images && images.length > 0 ? images : null;
  } catch (e) {
    await context.close();
    return null;
  }
}

async function getProductsToExpand() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?status=eq.active&is_digital=eq.false&select=id,name,slug,gallery&limit=500`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const all = await res.json();
  return all.filter(p =>
    p.gallery &&
    p.gallery.length === 1 &&
    p.gallery[0].src &&
    p.gallery[0].src.includes('m.media-amazon.com')
  );
}

async function updateGallery(id, name, images) {
  const gallery = images.map((src, i) => ({
    src,
    alt: i === 0 ? name : `${name} vue ${i + 1}`
  }));
  const body = JSON.stringify({ gallery, image: images[0] });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
    method: 'PATCH', headers: patchHeaders, body
  });
  if (!res.ok) throw new Error(`PATCH ${res.status}`);
}

async function main() {
  const args = process.argv.slice(2);
  const startIdx = parseInt(args[0] ?? '0');
  const batchSize = parseInt(args[1] ?? '999');

  const all = await getProductsToExpand();
  const products = all.slice(startIdx, startIdx + batchSize);
  console.log(`Batch ${startIdx}–${startIdx + products.length - 1} of ${all.length} total\n`);

  // Load existing results if any
  const resultsFile = 'reports/gallery-expand-results.json';
  const results = existsSync(resultsFile)
    ? JSON.parse(readFileSync(resultsFile, 'utf8'))
    : { expanded: [], single: [], failed: [] };

  const browser = await chromium.launch({ headless: true });

  for (let i = 0; i < products.length; i++) {
    const { id, name, slug } = products[i];
    process.stdout.write(`[${startIdx + i + 1}/${all.length}] ${name}... `);

    try {
      const images = await getImagesFromSearch(browser, name);

      if (!images || images.length < 2) {
        console.log(`(${images?.length ?? 0} image found)`);
        if (!results.single.find(s => s.slug === slug))
          results.single.push({ slug, name });
      } else {
        await updateGallery(id, name, images);
        console.log(`✓ ${images.length} photos`);
        results.expanded.push({ slug, name, count: images.length });
        // Remove from single if was there
        results.single = results.single.filter(s => s.slug !== slug);
      }

      // Save progress after each product
      writeFileSync(resultsFile, JSON.stringify(results, null, 2));

      // Polite delay: 3-5s random
      const delay = 3000 + Math.random() * 2000;
      await sleep(delay);
    } catch (e) {
      console.log(`✗ ${e.message}`);
      results.failed.push({ slug, name, error: e.message });
      writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    }
  }

  await browser.close();

  console.log(`\n═══ RESULTS ═══`);
  console.log(`Expanded: ${results.expanded.length} | Single: ${results.single.length} | Failed: ${results.failed.length}`);
}

main().catch(console.error);
