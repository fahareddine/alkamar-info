// api/_lib/images/processor.js
// ImageProcessorService — Replicate + sharp → 4 WebP 4:3 fond blanc → Supabase Storage

const sharp = require('sharp');
const { supabase } = require('../supabase');
const { ReplicateProvider } = require('./provider');

/** Dimensions des 4 sorties */
const OUTPUTS = [
  { name: 'card-cover',    w: 1200, h: 900  },
  { name: 'detail-main',   w: 1600, h: 1200 },
  { name: 'detail-side-1', w: 1600, h: 1200 },
  { name: 'detail-side-2', w: 1600, h: 1200 },
];

/**
 * Redimensionne un buffer PNG (fond transparent) vers un WebP 4:3 fond blanc
 * @param {Buffer} pngBuffer
 * @param {number} w
 * @param {number} h
 * @returns {Promise<Buffer>}
 */
async function resizeToWebP(pngBuffer, w, h) {
  return sharp(pngBuffer)
    .resize(w, h, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: '#ffffff' })
    .webp({ quality: 85 })
    .toBuffer();
}

/**
 * Upload un buffer WebP vers Supabase Storage
 * @returns {Promise<string>} URL publique
 */
async function uploadWebP(buffer, storagePath) {
  const { error } = await supabase.storage
    .from('products')
    .upload(storagePath, buffer, { contentType: 'image/webp', upsert: true });
  if (error) throw new Error(`Storage upload échoué (${storagePath}): ${error.message}`);
  const { data } = supabase.storage.from('products').getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Liste les fichiers source d'un produit dans Storage
 * @returns {Promise<string[]>} chemins relatifs ex: ["slug/source/01.jpg", ...]
 */
async function listSourceFiles(slug) {
  const { data, error } = await supabase.storage
    .from('products')
    .list(`${slug}/source`);
  if (error) throw new Error(`Impossible de lister les sources: ${error.message}`);
  return (data || []).map(f => `${slug}/source/${f.name}`);
}

/**
 * Génère une URL signée (1h) pour un fichier Storage (nécessaire pour Replicate)
 */
async function getSignedUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from('products')
    .createSignedUrl(storagePath, 3600);
  if (error) throw new Error(`URL signée impossible: ${error.message}`);
  return data.signedUrl;
}

/**
 * Traite les images sources d'un produit :
 * - Suppression fond via Replicate × (max 3 sources)
 * - Resize 4:3 + fond blanc + WebP via sharp
 * - Upload dans products/{slug}/processed/
 * - Mise à jour DB products + table product_images
 *
 * @param {object} options
 * @param {string} options.productId
 * @param {string} options.slug
 * @returns {Promise<{ status: string, cardCover: string, gallery: string[] }>}
 */
async function processImages({ productId, slug }) {
  const provider = new ReplicateProvider();

  await supabase.from('products').update({
    image_pipeline_status: 'processing',
  }).eq('id', productId);

  const sourcePaths = await listSourceFiles(slug);
  if (sourcePaths.length === 0) {
    throw new Error('Aucune image source trouvée dans Storage — lancez d\'abord fetch-images');
  }

  // Étape 1 : suppression fond pour chaque source (max 3)
  const pngBuffers = [];
  for (const path of sourcePaths.slice(0, 3)) {
    const signedUrl = await getSignedUrl(path);
    const pngBuffer = await provider.removeBackground(signedUrl);
    pngBuffers.push(pngBuffer);
  }

  // Étape 2 : mapping source → sorties
  // source 0 → card-cover + detail-main
  // source 1 → detail-side-1
  // source 2 → detail-side-2
  const sourceForOutput = {
    'card-cover':    pngBuffers[0],
    'detail-main':   pngBuffers[0],
    'detail-side-1': pngBuffers[1] || pngBuffers[0],
    'detail-side-2': pngBuffers[2] || pngBuffers[1] || pngBuffers[0],
  };

  const processedUrls = {};
  for (const { name, w, h } of OUTPUTS) {
    const webpBuffer = await resizeToWebP(sourceForOutput[name], w, h);
    const storagePath = `${slug}/processed/${name}.webp`;
    const url = await uploadWebP(webpBuffer, storagePath);
    processedUrls[name] = url;
  }

  const cardCoverUrl = processedUrls['card-cover'];
  const galleryUrls = [
    processedUrls['detail-main'],
    processedUrls['detail-side-1'],
    processedUrls['detail-side-2'],
  ];

  // Étape 3 : mise à jour DB products
  await supabase.from('products').update({
    image_pipeline_status: 'processed',
    image:           cardCoverUrl,
    main_image_url:  cardCoverUrl,
    gallery:         galleryUrls,
    gallery_urls:    galleryUrls,
    processed_at:    new Date().toISOString(),
    processing_error: null,
  }).eq('id', productId);

  // Étape 4 : product_images — supprimer anciennes + insérer 4 nouvelles
  await supabase.from('product_images').delete().eq('product_id', productId);

  const imageRows = [
    { product_id: productId, url: cardCoverUrl,                  role: 'card-cover',    position: 0 },
    { product_id: productId, url: processedUrls['detail-main'],  role: 'detail-main',   position: 1 },
    { product_id: productId, url: processedUrls['detail-side-1'],role: 'detail-side-1', position: 2 },
    { product_id: productId, url: processedUrls['detail-side-2'],role: 'detail-side-2', position: 3 },
  ];
  await supabase.from('product_images').insert(imageRows);

  return { status: 'processed', cardCover: cardCoverUrl, gallery: galleryUrls };
}

module.exports = { processImages };
