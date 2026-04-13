// api/_lib/images/fetcher.js
// ImageFetcherService — télécharge images (mode urls ou page) et les upload dans Supabase Storage

const { supabase } = require('../supabase');
const cheerio = require('cheerio');

/**
 * Télécharge une image depuis une URL et retourne un Buffer + content-type
 */
async function downloadImage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (HTML, like Gecko) Chrome/122.0 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} pour ${url}`);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

/**
 * Upload un buffer vers Supabase Storage
 * Retourne l'URL publique du fichier
 */
async function uploadToStorage(buffer, contentType, storagePath) {
  const { error } = await supabase.storage
    .from('products')
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });
  if (error) throw new Error(`Storage upload échoué (${storagePath}): ${error.message}`);

  const { data } = supabase.storage.from('products').getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Extrait les URLs d'images depuis une page HTML statique via cheerio
 * Filtre les logos, icônes, SVG et petites images
 */
async function extractImagesFromPage(pageUrl) {
  const response = await fetch(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (HTML, like Gecko) Chrome/122.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Page inaccessible: HTTP ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);

  const candidates = new Set();

  // og:image (priorité haute)
  $('meta[property="og:image"]').each((_, el) => {
    const src = $(el).attr('content');
    if (src) candidates.add(src);
  });

  // <img src> et data-src
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
    const w = parseInt($(el).attr('width') || '0', 10);
    const h = parseInt($(el).attr('height') || '0', 10);
    if (!src) return;
    if (w > 0 && w < 200) return;
    if (h > 0 && h < 200) return;
    candidates.add(src);
  });

  // Résoudre les URLs relatives, filtrer SVG et mots-clés logo/icon/banner
  const BLOCKED = /logo|icon|banner|sprite|avatar|placeholder|pixel|tracking/i;
  const filtered = [];
  for (const src of candidates) {
    if (src.startsWith('data:')) continue;
    if (/\.svg(\?|$)/i.test(src)) continue;
    if (BLOCKED.test(src)) continue;
    try {
      const absolute = new URL(src, base).href;
      filtered.push(absolute);
    } catch {
      // URL invalide, ignorer
    }
  }

  return filtered.slice(0, 3);
}

/**
 * Mode "urls" : télécharge 3 images directes et les upload dans Storage
 * Mode "page" : extrait les images d'une page HTML et les upload dans Storage
 *
 * @param {object} options
 * @param {string} options.productId
 * @param {string} options.slug
 * @param {'urls'|'page'} options.mode
 * @param {string[]} options.payload - URLs directes (mode urls) ou [pageUrl] (mode page)
 * @returns {Promise<{ status: string, sources: number, message?: string, sourceUrls: string[] }>}
 */
async function fetchImages({ productId, slug, mode, payload }) {
  let imageUrls = [];

  if (mode === 'urls') {
    imageUrls = payload.filter(u => u && u.startsWith('http'));
  } else if (mode === 'page') {
    imageUrls = await extractImagesFromPage(payload[0]);
  } else {
    throw new Error(`Mode inconnu: ${mode}`);
  }

  if (imageUrls.length === 0) {
    throw new Error('Aucune image exploitable trouvée');
  }

  // Mettre à jour le statut
  await supabase.from('products').update({
    image_pipeline_status: 'downloading',
    image_source_type: mode,
    image_source_payload: payload,
  }).eq('id', productId);

  const sourceUrls = [];
  const errors = [];

  for (let i = 0; i < Math.min(imageUrls.length, 3); i++) {
    try {
      const { buffer, contentType } = await downloadImage(imageUrls[i]);
      const ext = contentType.includes('png') ? 'png' : 'jpg';
      const storagePath = `${slug}/source/0${i + 1}.${ext}`;
      const publicUrl = await uploadToStorage(buffer, contentType, storagePath);
      sourceUrls.push(publicUrl);
    } catch (err) {
      errors.push(`Image ${i + 1}: ${err.message}`);
    }
  }

  const count = sourceUrls.length;

  // Mettre à jour en base
  const isPartial = count > 0 && count < 3;
  const status = count === 0 ? 'failed' : 'ready_for_processing';
  await supabase.from('products').update({
    image_pipeline_status: status,
    source_image_count: count,
    processing_error: errors.length ? errors.join(' | ') : null,
  }).eq('id', productId);

  if (count === 0) throw new Error('Toutes les images ont échoué au téléchargement');

  return {
    status: isPartial ? 'partial' : 'ready_for_processing',
    sources: count,
    sourceUrls,
    message: isPartial ? `${count}/3 images récupérées — complétez avec des URLs directes` : undefined,
  };
}

module.exports = { fetchImages };
