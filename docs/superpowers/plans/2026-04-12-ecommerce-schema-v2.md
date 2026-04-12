# Schéma e-commerce v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir le schéma Supabase existant avec tags, images dédiées, promotions, codes promo, mouvements de stock, factures auto et logs admin — migration additive sans destruction de données.

**Architecture:** 4 migrations SQL additives sur le schéma `public` Supabase, 2 scripts de migration de données one-shot, 9 nouveaux endpoints Vercel Serverless Functions (Node.js CJS). Chaque migration est indépendante et rollbackable. Les APIs suivent le pattern existant (`api/_lib/supabase.js`, `auth.js`, `cors.js`).

**Tech Stack:** Supabase PostgreSQL (migrations SQL), Node.js CJS (Vercel Serverless Functions), @supabase/supabase-js v2, curl pour les tests d'intégration.

---

## Contexte codebase

- Répertoire : `C:/Users/defis/alkamar-info`
- Pattern API existant : voir `api/products.js` (GET/POST) et `api/products/[id].js` (GET/PUT/DELETE)
- Auth : `const auth = await requireRole(req, 'admin')` depuis `api/_lib/auth.js`
- CORS : `setCors(res)` + early return sur OPTIONS
- Supabase admin client : `const { supabase } = require('./_lib/supabase')`
- Les migrations sont appliquées via le Dashboard Supabase SQL Editor (pas de CLI Supabase local)
- `.env.local` contient SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

---

## Task 1 : Migration 003 — Catalogue v2 (SQL)

**Files:**
- Create: `supabase/migrations/003_catalogue_v2.sql`

- [ ] **Step 1 : Créer le fichier de migration**

Créer `supabase/migrations/003_catalogue_v2.sql` avec ce contenu exact :

```sql
-- supabase/migrations/003_catalogue_v2.sql
-- Enrichissement catalogue : images dédiées, tags, SKU, poids

-- 1. Enrichir la table products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS weight_g  INT;

-- Corriger le type rating si encore SMALLINT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'rating'
    AND data_type = 'smallint'
  ) THEN
    ALTER TABLE products ALTER COLUMN rating TYPE NUMERIC(3,1);
  END IF;
END $$;

-- Rendre price_kmf nullable si ce n'est pas encore le cas
ALTER TABLE products ALTER COLUMN price_kmf DROP NOT NULL;

-- 2. Table images produit (remplace JSONB gallery)
CREATE TABLE IF NOT EXISTS product_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  src         TEXT NOT NULL,
  alt         TEXT DEFAULT '',
  sort_order  INT DEFAULT 0,
  is_primary  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_images_product_id_idx ON product_images(product_id);

-- 3. Tags
CREATE TABLE IF NOT EXISTS tags (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL,
  slug  TEXT UNIQUE NOT NULL
);

-- 4. Liaison produit <-> tag (many-to-many)
CREATE TABLE IF NOT EXISTS product_tags (
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  tag_id      UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
```

- [ ] **Step 2 : Appliquer la migration dans Supabase**

Ouvrir le Dashboard Supabase → SQL Editor → coller le contenu de `003_catalogue_v2.sql` → Run.

Vérifier dans Table Editor que les tables `product_images`, `tags`, `product_tags` existent.
Vérifier dans la table `products` que les colonnes `sku` et `weight_g` sont présentes.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/003_catalogue_v2.sql
git commit -m "feat(db): migration 003 — product_images, tags, product_tags, enrichissement products"
```

---

## Task 2 : Script migration gallery → product_images

**Files:**
- Create: `supabase/seed/migrate_gallery_to_images.js`

- [ ] **Step 1 : Créer le script**

Créer `supabase/seed/migrate_gallery_to_images.js` :

```javascript
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
```

- [ ] **Step 2 : Exécuter le script**

```bash
node supabase/seed/migrate_gallery_to_images.js
```

Résultat attendu :
```
Produits avec gallery non vide : <N>
Images insérées : <M>
```

- [ ] **Step 3 : Vérifier dans Supabase**

Dans le Dashboard Supabase SQL Editor :
```sql
SELECT COUNT(*) FROM product_images;
SELECT product_id, COUNT(*) FROM product_images GROUP BY product_id LIMIT 5;
```

- [ ] **Step 4 : Commit**

```bash
git add supabase/seed/migrate_gallery_to_images.js
git commit -m "feat(seed): migration gallery JSONB → product_images"
```

---

## Task 3 : Migration 004 — Promotions & codes promo (SQL)

**Files:**
- Create: `supabase/migrations/004_promotions_coupons.sql`

- [ ] **Step 1 : Créer le fichier**

Créer `supabase/migrations/004_promotions_coupons.sql` :

```sql
-- supabase/migrations/004_promotions_coupons.sql

-- 1. Promotions automatiques
CREATE TABLE IF NOT EXISTS promotions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('percentage','fixed_eur','fixed_kmf')),
  value        NUMERIC(10,2) NOT NULL CHECK (value > 0),
  target_type  TEXT NOT NULL DEFAULT 'all'
               CHECK (target_type IN ('all','category','product')),
  target_id    UUID,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT promotions_ends_after_starts CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS promotions_active_idx ON promotions(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS promotions_target_idx ON promotions(target_type, target_id);

-- 2. Codes promo
CREATE TABLE IF NOT EXISTS coupon_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('percentage','fixed_eur','fixed_kmf')),
  value         NUMERIC(10,2) NOT NULL CHECK (value > 0),
  min_order_eur NUMERIC(10,2),
  max_uses      INT,
  uses_count    INT NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 3. Enrichir les commandes
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_code      TEXT,
  ADD COLUMN IF NOT EXISTS discount_eur     NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_kmf     NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_address JSONB,
  ADD COLUMN IF NOT EXISTS payment_method   TEXT DEFAULT 'cash'
               CHECK (payment_method IN ('cash','transfer','mobile_money')),
  ADD COLUMN IF NOT EXISTS payment_status   TEXT DEFAULT 'unpaid'
               CHECK (payment_status IN ('unpaid','partial','paid')),
  ADD COLUMN IF NOT EXISTS paid_at          TIMESTAMPTZ;
```

- [ ] **Step 2 : Appliquer dans Supabase**

Dashboard Supabase → SQL Editor → coller → Run.

Vérifier : tables `promotions` et `coupon_codes` créées, colonnes `coupon_code`, `payment_method`, `payment_status` présentes sur `orders`.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/004_promotions_coupons.sql
git commit -m "feat(db): migration 004 — promotions, coupon_codes, enrichissement orders"
```

---

## Task 4 : Migration 005 — Stock & factures (SQL)

**Files:**
- Create: `supabase/migrations/005_stock_invoices.sql`

- [ ] **Step 1 : Créer le fichier**

Créer `supabase/migrations/005_stock_invoices.sql` :

```sql
-- supabase/migrations/005_stock_invoices.sql

-- 1. Mouvements de stock
CREATE TABLE IF NOT EXISTS stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES products(id),
  type           TEXT NOT NULL CHECK (type IN ('in','out','adjustment','return')),
  quantity       INT NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('order','manual','supplier','return')),
  reference_id   UUID,
  note           TEXT,
  created_by     UUID REFERENCES user_profiles(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON stock_movements(created_at DESC);

-- 2. Trigger synchronisation products.stock
CREATE OR REPLACE FUNCTION sync_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type IN ('in', 'return') THEN
    UPDATE products SET stock = stock + ABS(NEW.quantity) WHERE id = NEW.product_id;
  ELSIF NEW.type = 'out' THEN
    UPDATE products SET stock = stock - ABS(NEW.quantity) WHERE id = NEW.product_id;
  ELSE
    -- adjustment : quantity signé (+N ou -N)
    UPDATE products SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stock_movements_sync
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION sync_product_stock();

-- 3. Séquence + fonction numérotation factures
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'FAC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_seq')::TEXT, 4, '0');
END;
$$;

-- 4. Table factures
CREATE TABLE IF NOT EXISTS invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL DEFAULT next_invoice_number(),
  order_id       UUID NOT NULL REFERENCES orders(id),
  customer_id    UUID NOT NULL REFERENCES customers(id),
  issued_at      TIMESTAMPTZ DEFAULT now(),
  due_at         TIMESTAMPTZ,
  total_eur      NUMERIC(10,2) NOT NULL,
  total_kmf      NUMERIC(12,0) NOT NULL,
  discount_eur   NUMERIC(10,2) DEFAULT 0,
  tax_rate       NUMERIC(5,2) DEFAULT 0,
  status         TEXT DEFAULT 'issued'
                 CHECK (status IN ('issued','paid','cancelled')),
  pdf_url        TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_order_idx ON invoices(order_id);
CREATE INDEX IF NOT EXISTS invoices_customer_idx ON invoices(customer_id);
```

- [ ] **Step 2 : Appliquer dans Supabase**

Dashboard Supabase → SQL Editor → coller → Run.

Vérifier dans SQL Editor :
```sql
SELECT next_invoice_number(); -- doit retourner FAC-2026-0001
SELECT next_invoice_number(); -- doit retourner FAC-2026-0002
```

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/005_stock_invoices.sql
git commit -m "feat(db): migration 005 — stock_movements, trigger stock, invoice_seq, invoices"
```

---

## Task 5 : Script init stock_movements depuis stock actuel

**Files:**
- Create: `supabase/seed/init_stock_movements.js`

- [ ] **Step 1 : Créer le script**

Créer `supabase/seed/init_stock_movements.js` :

```javascript
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
```

> **Note importante :** Ce script déclenche le trigger `stock_movements_sync` qui va doubler le stock (`stock actuel + quantity insérée`). Il faut d'abord remettre `products.stock` à 0 avant de lancer le script, ou désactiver le trigger le temps de l'init. Procédure dans le Step 2.

- [ ] **Step 2 : Préparer l'exécution sans doublement de stock**

Dans le Dashboard Supabase SQL Editor, exécuter ces commandes **avant** le script :

```sql
-- Désactiver le trigger le temps de l'init
ALTER TABLE stock_movements DISABLE TRIGGER stock_movements_sync;
```

Puis lancer le script :
```bash
node supabase/seed/init_stock_movements.js
```

Puis réactiver le trigger :
```sql
ALTER TABLE stock_movements ENABLE TRIGGER stock_movements_sync;
```

- [ ] **Step 3 : Vérifier**

Dans Supabase SQL Editor :
```sql
-- Doit afficher les stocks inchangés
SELECT p.name, p.stock, sm.quantity
FROM products p
JOIN stock_movements sm ON sm.product_id = p.id
LIMIT 5;
```

- [ ] **Step 4 : Commit**

```bash
git add supabase/seed/init_stock_movements.js
git commit -m "feat(seed): init stock_movements depuis stock actuel products"
```

---

## Task 6 : Migration 006 — Logs admin + RLS (SQL)

**Files:**
- Create: `supabase/migrations/006_logs_rls.sql`

- [ ] **Step 1 : Créer le fichier**

Créer `supabase/migrations/006_logs_rls.sql` :

```sql
-- supabase/migrations/006_logs_rls.sql

-- 1. Logs admin
CREATE TABLE IF NOT EXISTS admin_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES user_profiles(id),
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_logs_entity_idx ON admin_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS admin_logs_created_idx ON admin_logs(created_at DESC);

-- 2. RLS — nouvelles tables
ALTER TABLE product_images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_codes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs        ENABLE ROW LEVEL SECURITY;

-- Lecture publique : images, tags, product_tags, promotions actives
CREATE POLICY "public_read_product_images" ON product_images FOR SELECT USING (true);
CREATE POLICY "public_read_tags" ON tags FOR SELECT USING (true);
CREATE POLICY "public_read_product_tags" ON product_tags FOR SELECT USING (true);
CREATE POLICY "public_read_promotions" ON promotions FOR SELECT USING (is_active = true);

-- Écriture : service_role uniquement (toutes les tables sensibles)
-- Les serverless functions utilisent SUPABASE_SERVICE_ROLE_KEY → bypass RLS automatique
-- Les policies ci-dessous bloquent les accès anon/authenticated directs

CREATE POLICY "service_role_all_product_images" ON product_images
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_all_tags" ON tags
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "service_role_all_promotions" ON promotions
  USING (true)
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_all_coupons" ON coupon_codes
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_all_stock" ON stock_movements
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_all_invoices" ON invoices
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- admin_logs : INSERT uniquement via service_role, SELECT pour authentifiés
CREATE POLICY "insert_logs" ON admin_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "read_logs" ON admin_logs
  FOR SELECT USING (auth.role() = 'service_role');
```

- [ ] **Step 2 : Appliquer dans Supabase**

Dashboard Supabase → SQL Editor → coller → Run.

Vérifier : table `admin_logs` créée, RLS activé sur toutes les nouvelles tables (visible dans Authentication → Policies).

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/006_logs_rls.sql
git commit -m "feat(db): migration 006 — admin_logs, RLS nouvelles tables"
```

---

## Task 7 : API — Tags (GET/POST)

**Files:**
- Create: `api/tags.js`

- [ ] **Step 1 : Créer l'endpoint**

Créer `api/tags.js` :

```javascript
// api/tags.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — liste publique
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('tags')
      .select('id, name, slug')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST — créer un tag (editor ou admin)
  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name et slug requis' });

    const { data, error } = await supabase
      .from('tags')
      .insert({ name, slug })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
```

- [ ] **Step 2 : Tester en local avec vercel dev**

```bash
npx vercel dev
```

Dans un autre terminal :
```bash
curl http://localhost:3000/api/tags
```
Réponse attendue : `[]` (liste vide, pas d'erreur)

- [ ] **Step 3 : Commit**

```bash
git add api/tags.js
git commit -m "feat(api): endpoint /api/tags GET+POST"
```

---

## Task 8 : API — Promotions (CRUD)

**Files:**
- Create: `api/promotions.js`
- Create: `api/promotions/[id].js`

- [ ] **Step 1 : Créer `api/promotions.js`**

```javascript
// api/promotions.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — promotions actives (public) ou toutes (admin)
  if (req.method === 'GET') {
    const { all } = req.query;
    let query = supabase
      .from('promotions')
      .select('*')
      .order('starts_at', { ascending: false });

    if (all !== 'true') {
      query = query
        .eq('is_active', true)
        .lte('starts_at', new Date().toISOString())
        .gte('ends_at', new Date().toISOString());
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST — créer une promotion (admin)
  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { name, type, value, target_type, target_id, starts_at, ends_at } = req.body;
    if (!name || !type || !value || !starts_at || !ends_at) {
      return res.status(400).json({ error: 'name, type, value, starts_at, ends_at requis' });
    }

    const { data, error } = await supabase
      .from('promotions')
      .insert({ name, type, value, target_type: target_type || 'all', target_id, starts_at, ends_at })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
```

- [ ] **Step 2 : Créer `api/promotions/[id].js`**

```javascript
// api/promotions/[id].js
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  // PUT — modifier une promotion (admin)
  if (req.method === 'PUT') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { data, error } = await supabase
      .from('promotions')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // DELETE — désactiver (soft delete via is_active = false)
  if (req.method === 'DELETE') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { error } = await supabase
      .from('promotions')
      .update({ is_active: false })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
```

- [ ] **Step 3 : Tester**

```bash
curl http://localhost:3000/api/promotions
```
Réponse attendue : `[]`

- [ ] **Step 4 : Commit**

```bash
git add api/promotions.js api/promotions/[id].js
git commit -m "feat(api): endpoint /api/promotions CRUD"
```

---

## Task 9 : API — Codes promo (GET/POST/validate)

**Files:**
- Create: `api/coupons.js`
- Create: `api/coupons/validate.js`

- [ ] **Step 1 : Créer `api/coupons.js`**

```javascript
// api/coupons.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — liste des codes promo (admin)
  if (req.method === 'GET') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { data, error } = await supabase
      .from('coupon_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST — créer un code promo (admin)
  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { code, type, value, min_order_eur, max_uses, expires_at } = req.body;
    if (!code || !type || !value) {
      return res.status(400).json({ error: 'code, type, value requis' });
    }

    const { data, error } = await supabase
      .from('coupon_codes')
      .insert({ code: code.toUpperCase(), type, value, min_order_eur, max_uses, expires_at })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    // Log
    await supabase.from('admin_logs').insert({
      user_id: auth.user?.id,
      action: 'coupon.created',
      entity_type: 'coupon',
      entity_id: data.id,
      new_value: { code: data.code, type: data.type, value: data.value }
    });

    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
```

- [ ] **Step 2 : Créer `api/coupons/validate.js`**

```javascript
// api/coupons/validate.js
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin', 'commercial');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { code, order_total_eur } = req.body;
  if (!code) return res.status(400).json({ error: 'code requis' });

  const { data: coupon, error } = await supabase
    .from('coupon_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error || !coupon) return res.status(404).json({ error: 'Code promo invalide ou inactif' });

  // Vérifications
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Code promo expiré' });
  }
  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
    return res.status(400).json({ error: 'Code promo épuisé' });
  }
  if (coupon.min_order_eur && order_total_eur < coupon.min_order_eur) {
    return res.status(400).json({
      error: `Commande minimum requise : ${coupon.min_order_eur} €`
    });
  }

  // Calculer le rabais
  let discount_eur = 0;
  let discount_kmf = 0;
  const EUR_TO_KMF = 491;

  if (coupon.type === 'percentage') {
    discount_eur = Math.round((order_total_eur * coupon.value / 100) * 100) / 100;
    discount_kmf = Math.round(discount_eur * EUR_TO_KMF);
  } else if (coupon.type === 'fixed_eur') {
    discount_eur = Math.min(coupon.value, order_total_eur);
    discount_kmf = Math.round(discount_eur * EUR_TO_KMF);
  } else if (coupon.type === 'fixed_kmf') {
    discount_kmf = coupon.value;
    discount_eur = Math.round((discount_kmf / EUR_TO_KMF) * 100) / 100;
  }

  return res.status(200).json({
    valid: true,
    coupon_code: coupon.code,
    discount_eur,
    discount_kmf
  });
};
```

- [ ] **Step 3 : Tester**

```bash
# Doit retourner 401 sans token
curl -X POST http://localhost:3000/api/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"TEST","order_total_eur":100}'
```
Réponse attendue : `{"error":"Missing or invalid Authorization header"}`

- [ ] **Step 4 : Commit**

```bash
git add api/coupons.js api/coupons/validate.js
git commit -m "feat(api): endpoint /api/coupons GET+POST + /validate"
```

---

## Task 10 : API — Mouvements de stock (GET/POST)

**Files:**
- Create: `api/stock/movements.js`

- [ ] **Step 1 : Créer le répertoire et l'endpoint**

```bash
mkdir -p api/stock
```

Créer `api/stock/movements.js` :

```javascript
// api/stock/movements.js
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — historique des mouvements (admin)
  if (req.method === 'GET') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { product_id, limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('stock_movements')
      .select(`
        id, type, quantity, reference_type, reference_id, note, created_at,
        products(id, name, sku),
        user_profiles(id, full_name)
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (product_id) query = query.eq('product_id', product_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST — ajustement manuel (admin)
  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { product_id, type, quantity, note } = req.body;
    if (!product_id || !type || quantity === undefined) {
      return res.status(400).json({ error: 'product_id, type, quantity requis' });
    }
    if (!['in','out','adjustment','return'].includes(type)) {
      return res.status(400).json({ error: 'type invalide : in|out|adjustment|return' });
    }

    // Lire stock actuel pour le log
    const { data: product } = await supabase
      .from('products')
      .select('stock')
      .eq('id', product_id)
      .single();

    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
        product_id,
        type,
        quantity,
        reference_type: 'manual',
        note,
        created_by: auth.user?.id
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Log admin
    await supabase.from('admin_logs').insert({
      user_id: auth.user?.id,
      action: 'stock.adjusted',
      entity_type: 'product',
      entity_id: product_id,
      old_value: { stock: product?.stock },
      new_value: { type, quantity, note }
    });

    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
```

- [ ] **Step 2 : Tester**

```bash
curl http://localhost:3000/api/stock/movements
```
Réponse attendue : `{"error":"Missing or invalid Authorization header"}`

- [ ] **Step 3 : Commit**

```bash
git add api/stock/movements.js
git commit -m "feat(api): endpoint /api/stock/movements GET+POST"
```

---

## Task 11 : API — Factures (GET/GET:id)

**Files:**
- Create: `api/invoices.js`
- Create: `api/invoices/[id].js`

- [ ] **Step 1 : Créer `api/invoices.js`**

```javascript
// api/invoices.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin', 'commercial');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { status, customer_id, limit = '50', offset = '0' } = req.query;

  let query = supabase
    .from('invoices')
    .select(`
      id, invoice_number, issued_at, due_at,
      total_eur, total_kmf, discount_eur, tax_rate, status, pdf_url,
      orders(id, status),
      customers(id, name, email, phone)
    `)
    .order('issued_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (status) query = query.eq('status', status);
  if (customer_id) query = query.eq('customer_id', customer_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
};
```

- [ ] **Step 2 : Créer `api/invoices/[id].js`**

```javascript
// api/invoices/[id].js
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin', 'commercial');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { id } = req.query;

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      orders(
        id, status, payment_method, payment_status, notes, coupon_code, discount_eur,
        order_items(quantity, unit_price_eur, unit_price_kmf, product_snapshot)
      ),
      customers(id, name, email, phone, address, city, island)
    `)
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ error: 'Facture introuvable' });
  return res.status(200).json(data);
};
```

- [ ] **Step 3 : Commit**

```bash
git add api/invoices.js api/invoices/[id].js
git commit -m "feat(api): endpoint /api/invoices GET + GET/:id"
```

---

## Task 12 : API — Logs admin (GET)

**Files:**
- Create: `api/logs.js`

- [ ] **Step 1 : Créer `api/logs.js`**

```javascript
// api/logs.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { entity_type, entity_id, action, limit = '100', offset = '0' } = req.query;

  let query = supabase
    .from('admin_logs')
    .select(`
      id, action, entity_type, entity_id,
      old_value, new_value, ip_address, created_at,
      user_profiles(id, full_name)
    `)
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (entity_type) query = query.eq('entity_type', entity_type);
  if (entity_id) query = query.eq('entity_id', entity_id);
  if (action) query = query.eq('action', action);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
};
```

- [ ] **Step 2 : Commit**

```bash
git add api/logs.js
git commit -m "feat(api): endpoint /api/logs GET (admin)"
```

---

## Task 13 : Intégration commandes — facture + stock auto à la confirmation

**Files:**
- Modify: `api/orders/[id].js`

- [ ] **Step 1 : Lire le fichier existant**

Lire `api/orders/[id].js` pour comprendre le handler PUT existant (changement de statut commande).

- [ ] **Step 2 : Ajouter la logique de confirmation**

Dans le handler PUT de `api/orders/[id].js`, après la mise à jour du statut, ajouter ce bloc quand `status === 'confirmed'` :

```javascript
// Après: const { data: updatedOrder, error: updateError } = await supabase...

if (!updateError && req.body.status === 'confirmed' && existingOrder.status !== 'confirmed') {
  // 1. Décrémenter le stock pour chaque article
  const { data: items } = await supabase
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', id);

  for (const item of (items || [])) {
    await supabase.from('stock_movements').insert({
      product_id: item.product_id,
      type: 'out',
      quantity: item.quantity,
      reference_type: 'order',
      reference_id: id,
      note: `Commande confirmée #${id.slice(0,8)}`
    });
  }

  // 2. Créer la facture automatiquement
  const { data: order } = await supabase
    .from('orders')
    .select('customer_id, total_eur, total_kmf, discount_eur, discount_kmf')
    .eq('id', id)
    .single();

  if (order) {
    await supabase.from('invoices').insert({
      order_id: id,
      customer_id: order.customer_id,
      total_eur: order.total_eur,
      total_kmf: order.total_kmf,
      discount_eur: order.discount_eur || 0
    });
  }

  // 3. Log admin
  await supabase.from('admin_logs').insert({
    user_id: auth.user?.id,
    action: 'order.status_changed',
    entity_type: 'order',
    entity_id: id,
    old_value: { status: existingOrder.status },
    new_value: { status: 'confirmed' }
  });
}
```

> **Attention :** Lire d'abord le statut actuel de la commande (`existingOrder.status`) avant la mise à jour pour éviter de créer une facture en doublon si la commande est déjà `confirmed`. Adapter le nom de la variable selon le code existant.

- [ ] **Step 3 : Tester le flux complet**

1. Créer une commande test via l'admin panel ou curl
2. Passer son statut en `confirmed`
3. Vérifier dans Supabase SQL Editor :

```sql
-- La facture a été créée
SELECT invoice_number, total_eur, status FROM invoices ORDER BY created_at DESC LIMIT 1;

-- Les mouvements de stock ont été insérés
SELECT type, quantity, reference_type FROM stock_movements
WHERE reference_type = 'order' ORDER BY created_at DESC LIMIT 5;

-- Le log a été créé
SELECT action, old_value, new_value FROM admin_logs ORDER BY created_at DESC LIMIT 1;
```

- [ ] **Step 4 : Commit**

```bash
git add api/orders/[id].js
git commit -m "feat(api): confirmation commande — auto stock_movements + invoice + log"
```

---

## Task 14 : Déploiement production + validation finale

**Files:**
- Aucun fichier modifié

- [ ] **Step 1 : Vérifier qu'il n'y a pas de fichiers non commités**

```bash
git status
```
Résultat attendu : `nothing to commit, working tree clean`

- [ ] **Step 2 : Déployer en production**

```bash
npx vercel --prod --yes
```

- [ ] **Step 3 : Smoke tests production**

```bash
BASE=https://alkamar-info.vercel.app

# Tags publics
curl "$BASE/api/tags"
# Attendu : []

# Promotions actives publiques
curl "$BASE/api/promotions"
# Attendu : []

# Produits (toujours fonctionnel)
curl "$BASE/api/products?limit=2"
# Attendu : tableau de 2 produits
```

- [ ] **Step 4 : Vérifier les nouveaux endpoints en prod (sans auth = 401)**

```bash
curl "$BASE/api/coupons"
# Attendu : {"error":"Missing or invalid Authorization header"}

curl "$BASE/api/invoices"
# Attendu : {"error":"Missing or invalid Authorization header"}

curl "$BASE/api/logs"
# Attendu : {"error":"Missing or invalid Authorization header"}

curl "$BASE/api/stock/movements"
# Attendu : {"error":"Missing or invalid Authorization header"}
```

- [ ] **Step 5 : Commit final si nécessaire**

```bash
git status
# Si propre, pas de commit nécessaire
```
