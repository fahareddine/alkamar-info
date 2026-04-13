# Image Pipeline IA — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin de fournir des URLs d'images ou une URL de page fournisseur et obtenir automatiquement 4 visuels WebP harmonisés (fond blanc, ratio 4:3) stockés dans Supabase Storage et liés au produit en base.

**Architecture:** Deux endpoints POST (`/api/products/fetch-images` et `/api/products/process-images`) orchestrent trois services CommonJS dans `api/_lib/images/`. Le fetcher télécharge et stocke les images sources dans Supabase Storage. Le processor appelle Replicate (BRIA-RMBG) pour supprimer les fonds, puis sharp.js pour recadrer/convertir en WebP 4:3. L'UI admin déclenche ces étapes et affiche les aperçus.

**Tech Stack:** Node.js CommonJS · Vercel Serverless · Supabase Storage + PostgreSQL · Replicate API (briaai/BRIA-RMBG-2.0) · sharp · cheerio · @supabase/supabase-js

---

## Fichiers à créer / modifier

| Action | Fichier | Responsabilité |
|--------|---------|----------------|
| Créer | `api/_lib/images/provider.js` | Interface + ReplicateProvider (suppression fond) |
| Créer | `api/_lib/images/fetcher.js` | ImageFetcherService (téléchargement + upload sources) |
| Créer | `api/_lib/images/processor.js` | ImageProcessorService (Replicate + sharp + upload processed) |
| Créer | `api/products/fetch-images.js` | Endpoint POST fetch-images |
| Créer | `api/products/process-images.js` | Endpoint POST process-images |
| Créer | `api/products/[id]/images.js` | Endpoint GET images status |
| Modifier | `admin/products/edit.html` | Ajouter section "Photos IA" après Médias |
| Modifier | `produit.html` | Fallback `main_image_url || image` |
| Modifier | `style.css` | `.card-img` aspect-ratio 4:3 |
| Modifier | `package.json` | Ajouter sharp, cheerio, replicate |

---

## Task 1 : Migration SQL — colonnes image pipeline

**Files:**
- Modify: Supabase Dashboard → SQL Editor (pas de fichier local de migration)

- [ ] **Step 1 : Exécuter la migration dans le Dashboard Supabase**

Aller dans Supabase Dashboard → SQL Editor → New Query, coller et exécuter :

```sql
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_source_type     TEXT
    CHECK (image_source_type IN ('urls','page','upload')),
  ADD COLUMN IF NOT EXISTS image_source_payload  JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS image_pipeline_status TEXT DEFAULT 'idle'
    CHECK (image_pipeline_status IN (
      'idle','downloading','ready_for_processing',
      'processing','processed','failed'
    )),
  ADD COLUMN IF NOT EXISTS source_image_count    INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS main_image_url        TEXT,
  ADD COLUMN IF NOT EXISTS gallery_urls          JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS processed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_error      TEXT;
```

- [ ] **Step 2 : Vérifier la migration**

Dans le SQL Editor, exécuter :

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN (
    'image_source_type','image_source_payload','image_pipeline_status',
    'source_image_count','main_image_url','gallery_urls',
    'processed_at','processing_error'
  );
```

Résultat attendu : 8 lignes retournées.

- [ ] **Step 3 : Créer le bucket Supabase Storage**

Dans Supabase Dashboard → Storage → New bucket :
- Name : `products`
- Public : OUI (cocher "Public bucket")
- Cliquer "Save"

- [ ] **Step 4 : Configurer les policies RLS du bucket**

Dans Supabase Dashboard → Storage → Policies → bucket `products` :

**Policy "Public read"** — cliquer "New Policy" → choisir "For full customization" :
```
Policy name: Public read products
Allowed operations: SELECT
Target roles: anon, authenticated
Policy definition: true
```

**Policy "Service role write"** — nouvelle policy :
```
Policy name: Service role write products
Allowed operations: INSERT, UPDATE, DELETE
Target roles: (laisser vide = service_role uniquement)
Policy definition: (role() = 'service_role')
```

---

## Task 2 : Installer les dépendances npm

**Files:**
- Modify: `package.json`

- [ ] **Step 1 : Installer sharp, cheerio, replicate**

```bash
npm install sharp cheerio replicate
```

- [ ] **Step 2 : Vérifier package.json**

`package.json` doit maintenant contenir :

```json
{
  "name": "alkamar-info",
  "version": "1.0.0",
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "cheerio": "^1.0.0",
    "replicate": "^1.0.1",
    "sharp": "^0.33.5"
  },
  "devDependencies": {
    "dotenv": "^16.0.0"
  }
}
```

- [ ] **Step 3 : Ajouter la variable d'environnement Replicate localement**

Dans `.env.local` (créer si absent) ajouter :

```
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxx
```

(Récupérer le token sur replicate.com → Account → API tokens après création du compte)

- [ ] **Step 4 : Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): ajout sharp, cheerio, replicate pour pipeline images"
```

---

## Task 3 : `api/_lib/images/provider.js` — ReplicateProvider

**Files:**
- Create: `api/_lib/images/provider.js`

- [ ] **Step 1 : Créer le dossier**

```bash
mkdir -p api/_lib/images
```

- [ ] **Step 2 : Créer `api/_lib/images/provider.js`**

```js
// api/_lib/images/provider.js
// Interface + ReplicateProvider pour suppression de fond via Replicate BRIA-RMBG-2.0

const Replicate = require('replicate');

class ReplicateProvider {
  constructor() {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN manquant');
    }
    this.client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }

  /**
   * Supprime le fond d'une image via Replicate BRIA-RMBG-2.0
   * @param {string} imageUrl - URL publique ou signée de l'image source
   * @returns {Promise<Buffer>} Buffer PNG fond transparent
   */
  async removeBackground(imageUrl) {
    const output = await this.client.run(
      'briaai/BRIA-RMBG-2.0',
      { input: { image: imageUrl } }
    );
    // output est une URL vers le PNG résultant
    const resultUrl = Array.isArray(output) ? output[0] : output;
    const response = await fetch(resultUrl);
    if (!response.ok) {
      throw new Error(`Échec téléchargement résultat Replicate: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

module.exports = { ReplicateProvider };
```

- [ ] **Step 3 : Test manuel — vérifier que l'import fonctionne**

Dans un terminal à la racine du projet :

```bash
node -e "const { ReplicateProvider } = require('./api/_lib/images/provider'); console.log('OK:', typeof ReplicateProvider)"
```

Résultat attendu : `OK: function`

- [ ] **Step 4 : Commit**

```bash
git add api/_lib/images/provider.js
git commit -m "feat(images): ReplicateProvider — suppression fond BRIA-RMBG-2.0"
```

---

## Task 4 : `api/_lib/images/fetcher.js` — ImageFetcherService

**Files:**
- Create: `api/_lib/images/fetcher.js`

- [ ] **Step 1 : Créer `api/_lib/images/fetcher.js`**

```js
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
```

- [ ] **Step 2 : Test manuel — vérifier que l'import fonctionne**

```bash
node -e "const { fetchImages } = require('./api/_lib/images/fetcher'); console.log('OK:', typeof fetchImages)"
```

Résultat attendu : `OK: function`

- [ ] **Step 3 : Commit**

```bash
git add api/_lib/images/fetcher.js
git commit -m "feat(images): ImageFetcherService — téléchargement et upload sources Storage"
```

---

## Task 5 : `api/_lib/images/processor.js` — ImageProcessorService

**Files:**
- Create: `api/_lib/images/processor.js`

- [ ] **Step 1 : Créer `api/_lib/images/processor.js`**

```js
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
```

- [ ] **Step 2 : Test manuel — vérifier que l'import fonctionne**

```bash
node -e "const { processImages } = require('./api/_lib/images/processor'); console.log('OK:', typeof processImages)"
```

Résultat attendu : `OK: function`

- [ ] **Step 3 : Commit**

```bash
git add api/_lib/images/processor.js
git commit -m "feat(images): ImageProcessorService — Replicate + sharp + upload WebP 4:3"
```

---

## Task 6 : Endpoint `POST /api/products/fetch-images`

**Files:**
- Create: `api/products/fetch-images.js`

- [ ] **Step 1 : Créer `api/products/fetch-images.js`**

```js
// api/products/fetch-images.js
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');
const { fetchImages } = require('../_lib/images/fetcher');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin', 'editor');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { productId, slug, mode, payload } = req.body || {};

  if (!productId || !slug) {
    return res.status(400).json({ error: 'productId et slug sont requis' });
  }
  if (!mode || !['urls', 'page'].includes(mode)) {
    return res.status(400).json({ error: 'mode doit être "urls" ou "page"' });
  }
  if (!Array.isArray(payload) || payload.length === 0) {
    return res.status(400).json({ error: 'payload doit être un tableau non vide' });
  }

  try {
    const result = await fetchImages({ productId, slug, mode, payload });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[fetch-images]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
```

- [ ] **Step 2 : Ajouter la route dans `vercel.json`**

Ouvrir `vercel.json` et ajouter dans le tableau `rewrites` (avant le wildcard final si présent) :

```json
{ "source": "/api/products/fetch-images", "destination": "/api/products/fetch-images" },
{ "source": "/api/products/process-images", "destination": "/api/products/process-images" }
```

> Note : Si `vercel.json` utilise déjà des rewrites dynamiques et que l'endpoint est dans `api/products/fetch-images.js`, Vercel le détecte automatiquement — vérifier que le fichier est bien dans `api/products/` et non `api/`.

- [ ] **Step 3 : Test manuel avec curl (après déploiement ou `vercel dev`)**

Récupérer un token admin en se connectant via le panel (`/admin`), puis :

```bash
curl -X POST http://localhost:3000/api/products/fetch-images \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"productId":"<UUID>","slug":"test-produit","mode":"urls","payload":["https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Bilin%C3%A7li_Yeralt%C4%B1_Depolama_Logo.svg/1200px-Bilin%C3%A7li_Yeralt%C4%B1_Depolama_Logo.svg.png"]}'
```

Résultat attendu : `{"status":"ready_for_processing","sources":1,...}` ou `{"status":"partial",...}`

- [ ] **Step 4 : Commit**

```bash
git add api/products/fetch-images.js vercel.json
git commit -m "feat(api): endpoint POST fetch-images — téléchargement sources produit"
```

---

## Task 7 : Endpoint `POST /api/products/process-images`

**Files:**
- Create: `api/products/process-images.js`

- [ ] **Step 1 : Créer `api/products/process-images.js`**

```js
// api/products/process-images.js
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');
const { processImages } = require('../_lib/images/processor');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin', 'editor');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { productId, slug } = req.body || {};

  if (!productId || !slug) {
    return res.status(400).json({ error: 'productId et slug sont requis' });
  }

  // Vercel Serverless timeout : 90s max (plan Hobby)
  // Si Replicate prend plus longtemps, retourner 202
  const TIMEOUT_MS = 85000;
  let timedOut = false;
  const timeoutId = setTimeout(() => { timedOut = true; }, TIMEOUT_MS);

  try {
    const resultPromise = processImages({ productId, slug });

    // Race entre le traitement et le timeout
    const result = await Promise.race([
      resultPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
      ),
    ]);

    clearTimeout(timeoutId);
    return res.status(200).json(result);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.message === 'TIMEOUT') {
      return res.status(202).json({
        status: 'processing',
        message: 'Traitement en cours, vérifier dans quelques secondes',
      });
    }
    console.error('[process-images]', err.message);
    // Enregistrer l'erreur en base
    const { supabase } = require('./_lib/supabase');
    await supabase.from('products').update({
      image_pipeline_status: 'failed',
      processing_error: err.message,
    }).eq('id', productId);
    return res.status(500).json({ error: err.message });
  }
};
```

- [ ] **Step 2 : Vérifier le require path dans le catch**

Le `require('./_lib/supabase')` dans le catch est relatif à `api/products/`. Corriger le chemin :

```js
// Dans le catch du handler, remplacer :
const { supabase } = require('./_lib/supabase');
// Par :
const { supabase } = require('../_lib/supabase');
```

- [ ] **Step 3 : Commit**

```bash
git add api/products/process-images.js
git commit -m "feat(api): endpoint POST process-images — traitement IA + upload WebP"
```

---

## Task 8 : Endpoint `GET /api/products/[id]/images`

**Files:**
- Create: `api/products/[id]/images.js`

- [ ] **Step 1 : Créer le dossier si nécessaire**

```bash
mkdir -p "api/products/[id]"
```

> **Attention Windows** : les crochets `[id]` sont valides comme nom de dossier mais doivent être créés avec `mkdir` ou l'explorateur — ne pas utiliser de pattern glob.

- [ ] **Step 2 : Créer `api/products/[id]/images.js`**

```js
// api/products/[id]/images.js
// GET public — statut pipeline et URLs des images d'un produit
const { supabase } = require('../../_lib/supabase');
const { setCors } = require('../../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;

  const { data, error } = await supabase
    .from('products')
    .select('id, image_pipeline_status, main_image_url, gallery_urls, image, gallery')
    .eq('id', id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Produit introuvable' });

  return res.status(200).json({
    pipelineStatus: data.image_pipeline_status || 'idle',
    main:    data.main_image_url || data.image || null,
    gallery: data.gallery_urls?.length ? data.gallery_urls : (data.gallery || []),
  });
};
```

- [ ] **Step 3 : Test manuel**

```bash
curl http://localhost:3000/api/products/<UUID>/images
```

Résultat attendu :
```json
{"pipelineStatus":"idle","main":null,"gallery":[]}
```

- [ ] **Step 4 : Commit**

```bash
git add "api/products/[id]/images.js"
git commit -m "feat(api): endpoint GET /api/products/[id]/images — statut pipeline"
```

---

## Task 9 : Section "Photos IA" dans `admin/products/edit.html`

**Files:**
- Modify: `admin/products/edit.html`

- [ ] **Step 1 : Ajouter la section HTML après la section "Médias" (ligne ~78)**

Dans `edit.html`, localiser la fermeture de la card Médias :
```html
            </div>
            <!-- /Médias -->
```

Ajouter juste après :

```html
            <!-- Photos IA -->
            <div class="form-card" id="ia-photos-card">
              <h2 style="display:flex;align-items:center;gap:10px">
                Photos IA
                <span id="ia-status-badge" class="ia-badge ia-badge--idle">● idle</span>
              </h2>

              <div class="form-group">
                <label>Source</label>
                <div style="display:flex;flex-direction:column;gap:6px">
                  <label style="font-weight:normal;display:flex;align-items:center;gap:8px">
                    <input type="radio" name="ia-source" value="urls" checked> URLs directes (3 images)
                  </label>
                  <label style="font-weight:normal;display:flex;align-items:center;gap:8px">
                    <input type="radio" name="ia-source" value="page"> Page fournisseur
                  </label>
                </div>
              </div>

              <div id="ia-urls-inputs">
                <div class="form-group">
                  <label>URL image 1</label>
                  <input type="url" id="ia-url-1" class="form-control" placeholder="https://...">
                </div>
                <div class="form-group">
                  <label>URL image 2</label>
                  <input type="url" id="ia-url-2" class="form-control" placeholder="https://...">
                </div>
                <div class="form-group">
                  <label>URL image 3</label>
                  <input type="url" id="ia-url-3" class="form-control" placeholder="https://...">
                </div>
              </div>

              <div id="ia-page-input" style="display:none">
                <div class="form-group">
                  <label>URL de la page fournisseur</label>
                  <input type="url" id="ia-page-url" class="form-control" placeholder="https://fournisseur.com/produit-xyz">
                </div>
              </div>

              <button type="button" id="btn-fetch-images" class="btn btn--ghost">↓ Récupérer les images</button>

              <div id="ia-sources-preview" style="display:none;margin-top:12px">
                <label style="font-size:13px;color:var(--admin-muted)">Aperçu sources</label>
                <div style="display:flex;gap:8px;margin-top:6px" id="ia-sources-thumbs"></div>
                <p id="ia-partial-msg" style="display:none;color:var(--admin-warning);font-size:13px;margin-top:6px"></p>
              </div>

              <button type="button" id="btn-process-images" class="btn btn--primary" style="margin-top:12px;display:none">
                ✨ Lancer traitement IA
              </button>

              <div id="ia-results" style="display:none;margin-top:16px">
                <label style="font-size:13px;color:var(--admin-muted)">Résultats</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px" id="ia-results-grid"></div>
              </div>
            </div>
            <!-- /Photos IA -->
```

- [ ] **Step 2 : Ajouter le CSS pour les badges dans `admin/css/admin.css`**

Ajouter à la fin de `admin/css/admin.css` :

```css
/* ── Photos IA ─────────────────── */
.ia-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  letter-spacing: 0.3px;
}
.ia-badge--idle        { background: #f1f5f9; color: #64748b; }
.ia-badge--downloading { background: #fef9c3; color: #a16207; }
.ia-badge--ready_for_processing { background: #dbeafe; color: #1d4ed8; }
.ia-badge--processing  { background: #fde68a; color: #92400e; }
.ia-badge--processed   { background: #dcfce7; color: #166534; }
.ia-badge--partial     { background: #fed7aa; color: #9a3412; }
.ia-badge--failed      { background: #fee2e2; color: #991b1b; }
```

- [ ] **Step 3 : Ajouter le JS dans `admin/products/edit.html` — bloc `<script>` existant**

Localiser la fin du `<script>` principal dans `edit.html` (avant `</script>`) et ajouter :

```js
// ── Photos IA ───────────────────────────────────────────────
(function() {
  const BADGES = {
    idle: 'idle', downloading: 'downloading',
    ready_for_processing: 'ready_for_processing',
    processing: 'processing', processed: 'processed',
    failed: 'failed', partial: 'partial',
  };

  function setIAStatus(status, label) {
    const badge = document.getElementById('ia-status-badge');
    if (!badge) return;
    badge.textContent = '● ' + (label || status);
    badge.className = 'ia-badge ia-badge--' + (BADGES[status] || 'idle');
  }

  // Toggle URLs / page
  document.querySelectorAll('input[name="ia-source"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isPage = radio.value === 'page';
      document.getElementById('ia-urls-inputs').style.display = isPage ? 'none' : '';
      document.getElementById('ia-page-input').style.display  = isPage ? '' : 'none';
    });
  });

  // Récupérer les images
  document.getElementById('btn-fetch-images')?.addEventListener('click', async () => {
    const mode = document.querySelector('input[name="ia-source"]:checked').value;
    const productId = new URLSearchParams(location.search).get('id');
    const slug = document.querySelector('[name="slug"]')?.value;
    if (!productId || !slug) { alert('Enregistrez le produit avant de lancer le pipeline'); return; }

    let payload;
    if (mode === 'urls') {
      payload = [
        document.getElementById('ia-url-1').value,
        document.getElementById('ia-url-2').value,
        document.getElementById('ia-url-3').value,
      ].filter(u => u.trim());
    } else {
      payload = [document.getElementById('ia-page-url').value.trim()];
    }
    if (payload.length === 0) { alert('Entrez au moins une URL'); return; }

    setIAStatus('downloading', 'téléchargement...');
    document.getElementById('btn-fetch-images').disabled = true;

    try {
      const data = await api.post('/api/products/fetch-images', { productId, slug, mode, payload });
      setIAStatus(data.status === 'partial' ? 'partial' : 'ready_for_processing', data.status);

      // Aperçu sources
      if (data.sourceUrls?.length) {
        const thumbs = document.getElementById('ia-sources-thumbs');
        thumbs.innerHTML = data.sourceUrls.map(url =>
          `<img src="${url}" style="width:80px;height:60px;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0">`
        ).join('');
        document.getElementById('ia-sources-preview').style.display = '';
        const partialMsg = document.getElementById('ia-partial-msg');
        if (data.status === 'partial') {
          partialMsg.textContent = data.message;
          partialMsg.style.display = '';
        } else {
          partialMsg.style.display = 'none';
        }
        document.getElementById('btn-process-images').style.display = '';
      }
    } catch (err) {
      setIAStatus('failed', 'erreur');
      alert('Erreur : ' + (err.message || err));
    } finally {
      document.getElementById('btn-fetch-images').disabled = false;
    }
  });

  // Lancer le traitement IA
  document.getElementById('btn-process-images')?.addEventListener('click', async () => {
    const productId = new URLSearchParams(location.search).get('id');
    const slug = document.querySelector('[name="slug"]')?.value;
    if (!productId || !slug) return;

    setIAStatus('processing', 'traitement IA...');
    document.getElementById('btn-process-images').disabled = true;

    try {
      const data = await api.post('/api/products/process-images', { productId, slug });

      if (data.status === 'processing') {
        setIAStatus('processing', 'en cours...');
        alert('Le traitement est en cours. Revenez dans quelques secondes et rechargez la page.');
        return;
      }

      setIAStatus('processed', 'traité ✓');

      // Afficher les résultats
      const grid = document.getElementById('ia-results-grid');
      const allUrls = [data.cardCover, ...(data.gallery || [])];
      const labels = ['card-cover', 'detail-main', 'side-1', 'side-2'];
      grid.innerHTML = allUrls.map((url, i) =>
        `<div style="text-align:center">
          <img src="${url}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0">
          <small style="color:var(--admin-muted)">${labels[i] || ''}</small>
        </div>`
      ).join('');
      document.getElementById('ia-results').style.display = '';

      // Mettre à jour l'aperçu image principale dans la section Médias
      const imgPreview = document.getElementById('img-preview');
      const imgInput   = document.querySelector('[name="image"]');
      if (imgPreview && data.cardCover) { imgPreview.src = data.cardCover; imgPreview.style.display = ''; }
      if (imgInput   && data.cardCover) { imgInput.value = data.cardCover; }

    } catch (err) {
      setIAStatus('failed', 'erreur');
      alert('Erreur traitement : ' + (err.message || err));
    } finally {
      document.getElementById('btn-process-images').disabled = false;
    }
  });

  // Charger le statut initial si produit existant
  const productId = new URLSearchParams(location.search).get('id');
  if (productId) {
    fetch(`/api/products/${productId}/images`)
      .then(r => r.json())
      .then(data => {
        if (data.pipelineStatus && data.pipelineStatus !== 'idle') {
          setIAStatus(data.pipelineStatus);
          if (data.pipelineStatus === 'processed' && data.main) {
            document.getElementById('ia-results').style.display = '';
            const grid = document.getElementById('ia-results-grid');
            const allUrls = [data.main, ...(data.gallery || [])];
            const labels = ['card-cover', 'detail-main', 'side-1', 'side-2'];
            grid.innerHTML = allUrls.map((url, i) =>
              `<div style="text-align:center">
                <img src="${url}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0">
                <small style="color:var(--admin-muted)">${labels[i] || ''}</small>
              </div>`
            ).join('');
          }
        }
      })
      .catch(() => {}); // silencieux si endpoint pas encore déployé
  }
})();
```

- [ ] **Step 4 : Commit**

```bash
git add admin/products/edit.html admin/css/admin.css
git commit -m "feat(admin): section Photos IA — fetch + traitement images pipeline"
```

---

## Task 10 : Mise à jour `produit.html` et CSS cartes

**Files:**
- Modify: `produit.html`
- Modify: `style.css`

- [ ] **Step 1 : Mettre à jour `produit.html` — image principale**

Dans `produit.html`, localiser la ligne qui construit l'URL de l'image principale du produit. Elle ressemble à :

```js
const imgUrl = p.image || '';
```

La remplacer par :

```js
const imgUrl = p.main_image_url || p.image || '';
```

- [ ] **Step 2 : Mettre à jour `produit.html` — galerie**

Localiser la construction de la galerie, qui ressemble à :

```js
const galleryUrls = p.gallery || [];
```

La remplacer par :

```js
const galleryUrls = (p.gallery_urls && p.gallery_urls.length > 0)
  ? p.gallery_urls
  : (p.gallery || [p.image].filter(Boolean));
```

- [ ] **Step 3 : Mettre à jour `style.css` — aspect-ratio cartes produit**

Dans `style.css`, localiser la règle `.card-img` (ou `.product-card img`) et s'assurer qu'elle contient :

```css
.card-img {
  aspect-ratio: 4 / 3;
  object-fit: contain;
  background: #f8fafc;
  width: 100%;
  display: block;
}
```

Si la règle n'existe pas, l'ajouter. Si elle existe, vérifier et ajouter uniquement les propriétés manquantes (`aspect-ratio`, `object-fit: contain`, `background`).

- [ ] **Step 4 : Commit**

```bash
git add produit.html style.css
git commit -m "feat(frontend): fallback main_image_url + gallery_urls, aspect-ratio 4:3 cartes"
```

---

## Task 11 : Déploiement et test end-to-end

- [ ] **Step 1 : Vérifier les variables d'environnement Vercel**

Dans Vercel Dashboard → Settings → Environment Variables, vérifier que ces 3 variables sont définies (Production + Preview) :

| Variable | Description |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role Supabase |
| `REPLICATE_API_TOKEN` | Token API Replicate (replicate.com → Account → API tokens) |

- [ ] **Step 2 : Déployer en production**

```bash
vercel --prod
```

- [ ] **Step 3 : Test end-to-end**

1. Aller sur `/admin/products/` → ouvrir ou créer un produit
2. Dans la section "Photos IA" :
   - Choisir "URLs directes"
   - Entrer une URL d'image produit (ex: image d'un laptop sur le site du fabricant)
   - Cliquer "↓ Récupérer les images" → statut passe à `ready_for_processing`, aperçu apparaît
3. Cliquer "✨ Lancer traitement IA" → attendre ~30-60s → statut passe à `processed`
4. Vérifier que les 4 miniatures apparaissent dans "Résultats"
5. Aller sur la page publique `/produit.html?id=<UUID>` → vérifier l'image principale et la galerie

- [ ] **Step 4 : Vérifier Supabase Storage**

Dans Supabase Dashboard → Storage → bucket `products` :
- Confirmer la présence de `{slug}/source/01.jpg` (ou .png)
- Confirmer la présence de `{slug}/processed/card-cover.webp`, `detail-main.webp`, etc.

---

## Récapitulatif des commits attendus

```
chore(deps): ajout sharp, cheerio, replicate pour pipeline images
feat(images): ReplicateProvider — suppression fond BRIA-RMBG-2.0
feat(images): ImageFetcherService — téléchargement et upload sources Storage
feat(images): ImageProcessorService — Replicate + sharp + upload WebP 4:3
feat(api): endpoint POST fetch-images — téléchargement sources produit
feat(api): endpoint POST process-images — traitement IA + upload WebP
feat(api): endpoint GET /api/products/[id]/images — statut pipeline
feat(admin): section Photos IA — fetch + traitement images pipeline
feat(frontend): fallback main_image_url + gallery_urls, aspect-ratio 4:3 cartes
```
