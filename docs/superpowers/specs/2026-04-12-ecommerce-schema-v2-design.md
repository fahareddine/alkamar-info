# Spec : Schéma e-commerce v2 — Alkamar Info

**Date :** 2026-04-12
**Sous-projet :** Backend e-commerce — enrichissement schema v2
**Approche :** Migration additive (ALTER TABLE + nouvelles tables, zéro destruction)

---

## 1. Principes directeurs

- **Additive only** : aucune colonne ni table existante n'est supprimée en v1
- **Stock double-écriture** : `products.stock` = source rapide, `stock_movements` = historique immuable, synchronisés par trigger
- **Snapshots à la commande** : prix et données figés dans `order_items.product_snapshot` et `invoices`
- **Logs append-only** : `admin_logs` ne permet que INSERT via service_role, jamais UPDATE/DELETE
- **Prix calculés à la volée** : le prix promotionnel n'est jamais stocké sur le produit

---

## 2. Schéma complet

### 2.1 Tables existantes — modifications

#### `products` — colonnes ajoutées
```sql
ALTER TABLE products
  ADD COLUMN sku        TEXT UNIQUE,
  ADD COLUMN weight_g   INT,
  ALTER COLUMN rating   TYPE NUMERIC(3,1),
  ALTER COLUMN price_kmf DROP NOT NULL;
```

> `gallery` JSONB conservée (non supprimée). Sera vidée après migration vers `product_images`.

---

### 2.2 Nouvelles tables catalogue

#### `product_images`
```sql
CREATE TABLE product_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  src         TEXT NOT NULL,
  alt         TEXT DEFAULT '',
  sort_order  INT DEFAULT 0,
  is_primary  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON product_images(product_id);
```

#### `tags`
```sql
CREATE TABLE tags (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL,
  slug  TEXT UNIQUE NOT NULL
);
```

#### `product_tags`
```sql
CREATE TABLE product_tags (
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  tag_id      UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
```

---

### 2.3 Promotions & codes promo

#### `promotions`
```sql
CREATE TABLE promotions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('percentage','fixed_eur','fixed_kmf')),
  value        NUMERIC(10,2) NOT NULL CHECK (value > 0),
  target_type  TEXT NOT NULL DEFAULT 'all'
               CHECK (target_type IN ('all','category','product')),
  target_id    UUID,           -- category_id ou product_id selon target_type
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ends_after_starts CHECK (ends_at > starts_at)
);
CREATE INDEX ON promotions(is_active, starts_at, ends_at);
CREATE INDEX ON promotions(target_type, target_id);
```

**Calcul prix promotionnel (logique API) :**
```
SELECT p FROM promotions p
WHERE is_active = true
  AND now() BETWEEN starts_at AND ends_at
  AND (
    target_type = 'all'
    OR (target_type = 'product'  AND target_id = :product_id)
    OR (target_type = 'category' AND target_id = :category_id)
  )
ORDER BY value DESC LIMIT 1
```

#### `coupon_codes`
```sql
CREATE TABLE coupon_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('percentage','fixed_eur','fixed_kmf')),
  value        NUMERIC(10,2) NOT NULL CHECK (value > 0),
  min_order_eur NUMERIC(10,2),          -- montant minimum de commande (nullable = sans minimum)
  max_uses     INT,                      -- nullable = illimité
  uses_count   INT NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ,             -- nullable = sans expiration
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

---

### 2.4 Enrichissement commandes

#### `orders` — colonnes ajoutées
```sql
ALTER TABLE orders
  ADD COLUMN coupon_code      TEXT,
  ADD COLUMN discount_eur     NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN discount_kmf     NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN shipping_address JSONB,
  ADD COLUMN payment_method   TEXT DEFAULT 'cash'
             CHECK (payment_method IN ('cash','transfer','mobile_money')),
  ADD COLUMN payment_status   TEXT DEFAULT 'unpaid'
             CHECK (payment_status IN ('unpaid','partial','paid')),
  ADD COLUMN paid_at          TIMESTAMPTZ;
```

**Pipeline statuts :**
```
pending → confirmed → shipped → delivered
       ↘           ↘
        cancelled   cancelled
```

Transition `pending → confirmed` déclenche (via trigger ou API) :
1. INSERT dans `stock_movements` (type `out`, référence order_id)
2. INSERT dans `invoices`

---

### 2.5 Factures

#### `invoices`
```sql
CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,   -- FAC-2026-001
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
  pdf_url        TEXT,                   -- Supabase Storage (Phase 2)
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON invoices(order_id);
CREATE INDEX ON invoices(customer_id);
```

#### Fonction numérotation séquentielle
```sql
CREATE SEQUENCE invoice_seq START 1;

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'FAC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_seq')::TEXT, 4, '0');
END;
$$;
```
> Utilisation : `invoice_number = next_invoice_number()` à l'INSERT.

---

### 2.6 Stock

#### `stock_movements`
```sql
CREATE TABLE stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES products(id),
  type           TEXT NOT NULL CHECK (type IN ('in','out','adjustment','return')),
  quantity       INT NOT NULL CHECK (quantity > 0),
  reference_type TEXT CHECK (reference_type IN ('order','manual','supplier','return')),
  reference_id   UUID,
  note           TEXT,
  created_by     UUID REFERENCES user_profiles(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON stock_movements(product_id);
CREATE INDEX ON stock_movements(created_at DESC);
```

#### Trigger synchronisation stock
```sql
CREATE OR REPLACE FUNCTION sync_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type IN ('in', 'return') THEN
    UPDATE products SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
  ELSE
    UPDATE products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stock_movements_sync
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION sync_product_stock();
```

---

### 2.7 Logs admin

#### `admin_logs`
```sql
CREATE TABLE admin_logs (
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
CREATE INDEX ON admin_logs(entity_type, entity_id);
CREATE INDEX ON admin_logs(created_at DESC);
```

**Actions normalisées :**

| action | entity_type | Déclencheur |
|---|---|---|
| `product.price_changed` | `product` | Modification price_eur / price_kmf |
| `product.status_changed` | `product` | Changement de statut produit |
| `stock.adjusted` | `product` | Mouvement type adjustment ou in |
| `order.status_changed` | `order` | Tout changement de statut commande |
| `order.cancelled` | `order` | Passage en cancelled |
| `coupon.applied` | `order` | Code promo utilisé à la commande |
| `coupon.created` | `coupon` | Nouveau code promo créé |
| `invoice.issued` | `invoice` | Facture générée automatiquement |
| `user.role_changed` | `user` | Modification de rôle admin |

**RLS :** INSERT via service_role uniquement. SELECT pour admin. Aucun UPDATE/DELETE autorisé.

---

## 3. Relations — vue d'ensemble

```
categories ──< products >── product_images
                 │    └──< product_tags >── tags
                 │
             promotions (cible product ou category)
                 │
customers ──< orders >── order_items >── products
              │   └── coupon_codes
              │
           invoices
              │
        stock_movements >── products
              │
          admin_logs >── user_profiles
```

---

## 4. Nouveaux endpoints API

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/promotions` | Public | Promotions actives |
| POST | `/api/promotions` | admin | Créer une promotion |
| PUT | `/api/promotions/:id` | admin | Modifier |
| DELETE | `/api/promotions/:id` | admin | Désactiver |
| GET | `/api/coupons` | admin | Liste codes promo |
| POST | `/api/coupons` | admin | Créer code promo |
| POST | `/api/coupons/validate` | commercial, admin | Valider un code |
| GET | `/api/invoices` | admin, commercial | Liste factures |
| GET | `/api/invoices/:id` | admin, commercial | Détail facture |
| GET | `/api/stock/movements` | admin | Historique mouvements |
| POST | `/api/stock/movements` | admin | Ajustement manuel |
| GET | `/api/logs` | admin | Logs métier |
| GET | `/api/tags` | Public | Liste tags |
| POST | `/api/tags` | admin, editor | Créer tag |

---

## 5. Plan de migration

### Migration 003 — Catalogue enrichissement
- `ALTER TABLE products` (sku, weight_g, rating type, price_kmf nullable)
- CREATE `product_images`, `tags`, `product_tags`
- Script one-shot : migrer `gallery` JSONB → `product_images`

### Migration 004 — Promotions & coupons
- CREATE `promotions`, `coupon_codes`
- `ALTER TABLE orders` (coupon_code, discount_*, shipping_address, payment_*)

### Migration 005 — Stock & factures
- CREATE `stock_movements`, trigger `sync_product_stock`
- CREATE sequence `invoice_seq`, fonction `next_invoice_number()`
- CREATE `invoices`
- Script one-shot : initialiser `stock_movements` depuis `products.stock` actuel

### Migration 006 — Logs & RLS
- CREATE `admin_logs`
- RLS policies pour toutes les nouvelles tables

---

## 6. Hors scope (v1)

- Génération PDF des factures (Phase 2 — Edge Function ou service externe)
- Multi-devise dynamique (le taux EUR/KMF reste fixe à 491)
- Variantes produit (taille, couleur)
- Panier client public (sous-projet 2)
- Notifications email automatiques
