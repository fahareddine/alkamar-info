# Spec : Pipeline Images IA — Alkamar Info

**Date :** 2026-04-13
**Sous-projet :** Image Pipeline (récupération + traitement IA)
**Stack :** Vercel Serverless · Supabase Storage · Replicate (BRIA-RMBG) · sharp.js · cheerio

---

## 1. Objectif

Permettre à l'admin de fournir une URL de page fournisseur ou 3 URLs d'images directes, et obtenir automatiquement 4 visuels WebP harmonisés (fond blanc, ratio 4:3 uniforme) stockés dans Supabase Storage et liés au produit en base.

---

## 2. Architecture générale

```
Admin UI (edit.html — section "Photos IA")
   │
   ├─ POST /api/products/fetch-images
   │     └─ ImageFetcherService (api/_lib/images/fetcher.js)
   │           ├─ mode "urls"  → download 3 images directement
   │           └─ mode "page"  → fetch HTML → cheerio → extraire + filtrer images
   │                             si < 3 : retour partiel {partial:true, found:N}
   │           └─ upload Supabase Storage → products/{slug}/source/
   │           └─ UPDATE products SET image_pipeline_status='ready_for_processing'
   │
   └─ POST /api/products/process-images
         └─ ImageProcessorService (api/_lib/images/processor.js)
               ├─ download sources depuis Storage
               ├─ ReplicateProvider → BRIA-RMBG (suppression fond × 3)
               ├─ sharp.js → resize 4:3 + fond blanc + WebP
               │     ├─ card-cover.webp    1200×900
               │     ├─ detail-main.webp   1600×1200
               │     ├─ detail-side-1.webp 1600×1200
               │     └─ detail-side-2.webp 1600×1200
               ├─ upload → products/{slug}/processed/
               └─ UPDATE products (image, gallery, main_image_url, gallery_urls, processed_at)
                  INSERT product_images × 4
```

---

## 3. Supabase Storage

**Bucket :** `products` (public read, authenticated write)

**Structure :**
```
products/
  {slug}/
    source/
      01.jpg
      02.jpg
      03.jpg
    processed/
      card-cover.webp
      detail-main.webp
      detail-side-1.webp
      detail-side-2.webp
```

**Politique RLS :**
- Read : public
- Write/Delete : service_role uniquement (via backend Vercel)

---

## 4. Migrations SQL

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

Les colonnes existantes `image` et `gallery` sont conservées et mises à jour en fin de pipeline (rétrocompatibilité totale).

---

## 5. Services backend

### 5.1 `api/_lib/images/provider.js` — AbstractImageProvider

Interface abstraite pour le provider IA. Permet de switcher de Replicate vers un autre service sans modifier les services consommateurs.

```js
class ImageProvider {
  async removeBackground(imageUrl) { throw new Error('not implemented') }
}
class ReplicateProvider extends ImageProvider {
  // Replicate briaai/BRIA-RMBG-2.0
  async removeBackground(imageUrl) { ... }
}
module.exports = { ReplicateProvider }
```

Variable d'environnement requise : `REPLICATE_API_TOKEN`

### 5.2 `api/_lib/images/fetcher.js` — ImageFetcherService

**mode `urls`**
- Reçoit `[url1, url2, url3]`
- `downloadImage(url)` → buffer
- Upload vers `products/{slug}/source/01.jpg`, `02.jpg`, `03.jpg`
- Retourne `{ sources: 3, status: 'ready_for_processing' }`

**mode `page`**
- Reçoit `[pageUrl]`
- `fetch(pageUrl)` → HTML (headers User-Agent navigateur pour éviter 403)
- Cheerio : extraire `<img src>`, `meta[property="og:image"]`, `[data-src]`
- Filtrer : ignorer < 200×200px (si dimensions disponibles), SVG, logos (`logo`, `icon`, `banner` dans l'URL), doublons
- Trier par taille décroissante, garder les 3 premières
- Si < 3 images valides : retour `{ partial: true, found: N, sources: [...] }`
- Upload des images trouvées

### 5.3 `api/_lib/images/processor.js` — ImageProcessorService

1. Lister les fichiers `products/{slug}/source/` dans Storage
2. Pour chaque source (max 3) :
   - Générer une URL signée (1h) pour Replicate
   - `provider.removeBackground(signedUrl)` → PNG fond transparent
3. `sharp(buffer)` par sortie :
   - `.resize(w, h, { fit: 'contain', background: '#FFFFFF' })` — produit centré, fond blanc
   - `.webp({ quality: 85 })`
4. Mapping image → sortie :
   - source 01 → `card-cover.webp` (1200×900) + `detail-main.webp` (1600×1200)
   - source 02 → `detail-side-1.webp` (1600×1200)
   - source 03 → `detail-side-2.webp` (1600×1200)
5. Upload `products/{slug}/processed/`
6. Construire les URLs publiques Supabase Storage
7. `UPDATE products SET image=card-cover-url, gallery=[detail-main, side-1, side-2], main_image_url=card-cover-url, gallery_urls=[...], processed_at=now()`
8. `DELETE FROM product_images WHERE product_id=id` puis `INSERT product_images × 4`

---

## 6. Endpoints API

### `POST /api/products/fetch-images` *(requireRole admin/editor)*

```json
// Body
{
  "productId": "uuid",
  "slug": "hp-elitebook-840-g5",
  "mode": "urls",
  "payload": ["https://...", "https://...", "https://..."]
}

// Réponse 200
{ "status": "ready_for_processing", "sources": 3 }

// Réponse 200 (partiel)
{ "status": "partial", "sources": 2, "message": "2 images trouvées sur 3" }

// Réponse 500
{ "error": "Aucune image exploitable trouvée sur cette page" }
```

### `POST /api/products/process-images` *(requireRole admin/editor)*

```json
// Body
{ "productId": "uuid", "slug": "hp-elitebook-840-g5" }

// Réponse 200
{
  "status": "processed",
  "cardCover": "https://supabase.../products/hp.../processed/card-cover.webp",
  "gallery": ["detail-main.webp", "detail-side-1.webp", "detail-side-2.webp"]
}

// Si Replicate tarde > 90s : Réponse 202
{ "status": "processing", "message": "Traitement en cours, vérifier dans quelques secondes" }
```

### `GET /api/products/[id]/images` *(public)*

```json
{
  "pipelineStatus": "processed",
  "main": "https://.../card-cover.webp",
  "gallery": ["https://.../detail-main.webp", "...side-1.webp", "...side-2.webp"]
}
```

---

## 7. Interface Admin

Section ajoutée dans `admin/products/edit.html` après la galerie existante :

```
┌─────────────────────────────────────────┐
│ 📸 Photos IA                    [● idle] │
├─────────────────────────────────────────┤
│ Source :  ○ URLs directes               │
│           ○ Page fournisseur            │
│           ○ Upload manuel               │
│                                         │
│ [URL image 1 ____________________]      │
│ [URL image 2 ____________________]      │
│ [URL image 3 ____________________]      │
│                                         │
│       [↓ Récupérer les images]          │
│                                         │
│ Aperçu sources :  [img1] [img2] [img3]  │
│                                         │
│       [✨ Lancer traitement IA]         │
│                                         │
│ Résultats :                             │
│  [card-cover] [detail-main]             │
│  [side-1]     [side-2]                  │
└─────────────────────────────────────────┘
```

**Cycle de statut affiché :**
`idle` → `downloading` → `ready_for_processing` → `processing` → `processed` / `failed`

En cas de statut `partial` : afficher les images trouvées + message "X/3 images récupérées — complétez avec des URLs directes".

---

## 8. Frontend public — modifications

**`produit.html`**
- Image principale : `p.main_image_url || p.image` (fallback sans régression)
- Galerie : `p.gallery_urls?.length ? p.gallery_urls : (p.gallery || [p.image])`

**Pages catégories (`ordinateurs.html` et locales)**
- Card image : `p.main_image_url || p.image`
- CSS `.card-img` : `aspect-ratio: 4/3; object-fit: contain; background: #f8fafc`

---

## 9. Variables d'environnement requises

| Variable | Usage |
|---|---|
| `REPLICATE_API_TOKEN` | Authentification Replicate API |
| `SUPABASE_URL` | Déjà présente |
| `SUPABASE_SERVICE_ROLE_KEY` | Déjà présente |

---

## 10. Dépendances npm à ajouter

```bash
npm install sharp cheerio replicate
```

- `sharp` : traitement image (resize, WebP, fond blanc)
- `cheerio` : parsing HTML pour extraction images
- `replicate` : client officiel Replicate

---

## 11. Gestion d'erreurs

| Scénario | Comportement |
|---|---|
| URL image inaccessible (403, timeout) | Ignorer + continuer avec les images disponibles |
| Page fournisseur bloquée | Retourner `{ partial: true, found: 0 }` + message explicite |
| Replicate timeout (> 90s) | Retourner 202 + status `processing` |
| Replicate erreur API | Retourner 500 + `processing_error` enregistré en DB |
| sharp crash | Retourner 500 + log détaillé |

---

## 12. Ordre d'implémentation

1. Migration SQL (colonnes `image_pipeline_*`)
2. Création bucket Supabase Storage `products`
3. `api/_lib/images/provider.js` (ReplicateProvider)
4. `api/_lib/images/fetcher.js` (ImageFetcherService)
5. `api/_lib/images/processor.js` (ImageProcessorService)
6. `api/products/fetch-images.js` (endpoint)
7. `api/products/process-images.js` (endpoint)
8. `api/products/[id]/images.js` (endpoint GET)
9. Section "Photos IA" dans `admin/products/edit.html`
10. Mise à jour `produit.html` + CSS cartes produit
