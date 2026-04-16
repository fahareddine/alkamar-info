// api/_lib/scraper.js
// Scrape une page produit : JSON-LD schema.org > Open Graph > DOM cheerio
const cheerio = require('cheerio');

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Page inaccessible : HTTP ${res.status}`);
  return res.text();
}

function extractJsonLd(html) {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const raw = JSON.parse($(scripts[i]).html());
      const items = Array.isArray(raw) ? raw : [raw];
      for (const item of items) {
        if (item['@type'] === 'Product') return item;
        if (item['@graph']) {
          const p = item['@graph'].find(n => n['@type'] === 'Product');
          if (p) return p;
        }
      }
    } catch {}
  }
  return null;
}

function extractMeta($) {
  return {
    title:       $('meta[property="og:title"]').attr('content') || $('title').text() || '',
    description: $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '',
    image:       $('meta[property="og:image"]').attr('content') || '',
    price:       $('meta[property="product:price:amount"]').attr('content') || '',
    brand:       $('meta[property="product:brand"]').attr('content') || '',
  };
}

function toFloat(val) {
  if (!val) return null;
  const n = parseFloat(String(val).replace(/[^\d.,]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Supprime les paramètres de taille Amazon dans les URLs d'images
function cleanImageUrl(url) {
  if (!url) return url;
  // Ex: ._AC_SX300_SY300_. → .  ou  ._SL300_. → .
  return url.replace(/\._[A-Z0-9_,]+_\./g, '.');
}

// Extrait les points forts (bullet list) — Amazon + générique
function extractFeatures($) {
  const features = [];

  // Amazon : #feature-bullets
  $('#feature-bullets li span.a-list-item').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 5 && !/^A propos|^About this/i.test(text)) {
      features.push(text);
    }
  });

  // Générique si rien trouvé
  if (features.length === 0) {
    const selectors = ['.product-features li', '[class*="feature"] li', '[class*="highlight"] li', '.product-bullets li'];
    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 5) features.push(text);
      });
      if (features.length > 0) break;
    }
  }

  return features.slice(0, 8);
}

function domImages($, baseUrl) {
  const base = new URL(baseUrl);
  const BLOCKED = /logo|icon|banner|sprite|avatar|placeholder|pixel|tracking/i;
  const seen = new Set();
  const imgs = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
    if (!src || src.startsWith('data:')) return;
    if (/\.svg(\?|$)/i.test(src) || BLOCKED.test(src)) return;
    const w = parseInt($(el).attr('width') || '0', 10);
    const h = parseInt($(el).attr('height') || '0', 10);
    if ((w > 0 && w < 100) || (h > 0 && h < 100)) return;
    try {
      const abs = new URL(src, base).href;
      if (!seen.has(abs)) { seen.add(abs); imgs.push(abs); }
    } catch {}
  });
  return imgs.slice(0, 6);
}

async function scrapeProduct(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const ld = extractJsonLd(html);
  const meta = extractMeta($);

  let name = '', brand = '', description = '', priceEur = null, image = '', gallery = [], features = [];

  if (ld) {
    name        = ld.name || '';
    brand       = typeof ld.brand === 'object' ? (ld.brand.name || '') : (ld.brand || '');
    description = ld.description || '';

    const offers = ld.offers;
    if (offers) {
      const offer = Array.isArray(offers) ? offers[0] : offers;
      priceEur = toFloat(offer.price);
    }

    const ldImgs = ld.image;
    if (ldImgs) {
      const arr = Array.isArray(ldImgs) ? ldImgs : [ldImgs];
      image   = cleanImageUrl(typeof arr[0] === 'string' ? arr[0] : (arr[0]?.url || ''));
      gallery = arr.slice(1).map(i => cleanImageUrl(typeof i === 'string' ? i : (i?.url || ''))).filter(Boolean);
    }
  }

  // Fallback meta
  if (!name)        name        = meta.title;
  if (!brand)       brand       = meta.brand;
  if (!description) description = meta.description;
  if (!priceEur)    priceEur    = toFloat(meta.price);
  if (!image)       image       = cleanImageUrl(meta.image);

  // Fallback DOM
  if (!name) name = $('h1').first().text().trim();

  if (!image || gallery.length === 0) {
    const di = domImages($, url).map(cleanImageUrl);
    if (!image && di.length > 0) image = di[0];
    if (gallery.length === 0) gallery = di.slice(image ? 1 : 2, 5);
  }

  // Points forts
  features = extractFeatures($);

  description = truncateDescription(description.replace(/<[^>]+>/g, '').trim());
  name = name.trim();

  const product = {
    name,
    brand:       brand.trim(),
    description,
    slug:        slugify(name),
    image:       image || null,
    gallery:     gallery,
    features:    features,
    status:      'draft',
    specs:       {},
  };
  if (priceEur !== null) product.price_eur = priceEur;

  return product;
}

function truncateDescription(text, maxLen = 600) {
  if (!text || text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastSentence > maxLen * 0.5) return cut.slice(0, lastSentence + 1).trim();
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

module.exports = { scrapeProduct };
