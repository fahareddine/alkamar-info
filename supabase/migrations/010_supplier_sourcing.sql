-- supabase/migrations/010_supplier_sourcing.sql
-- Fonctionnalite sourcing fournisseur (admin uniquement)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_url          TEXT,
  ADD COLUMN IF NOT EXISTS supplier_name         TEXT,
  ADD COLUMN IF NOT EXISTS supplier_price        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS supplier_currency     TEXT DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS supplier_shipping     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS supplier_delivery     TEXT,
  ADD COLUMN IF NOT EXISTS supplier_availability TEXT DEFAULT 'unknown'
    CHECK (supplier_availability IN ('in_stock','out_of_stock','unknown')),
  ADD COLUMN IF NOT EXISTS supplier_last_checked TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supplier_notes        TEXT;

CREATE TABLE IF NOT EXISTS product_supplier_offers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_name    TEXT NOT NULL,
  supplier_url     TEXT NOT NULL,
  title            TEXT,
  price            NUMERIC(10,2),
  currency         TEXT DEFAULT 'EUR',
  shipping_price   NUMERIC(10,2),
  delivery_estimate TEXT,
  availability     TEXT DEFAULT 'unknown'
    CHECK (availability IN ('in_stock','out_of_stock','unknown')),
  score            NUMERIC(5,2),
  source           TEXT,
  country          TEXT DEFAULT 'FR',
  confidence       SMALLINT DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  is_primary       BOOLEAN DEFAULT FALSE,
  last_checked_at  TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_offers_product ON product_supplier_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_offers_score   ON product_supplier_offers(product_id, score DESC);

ALTER TABLE product_supplier_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_supplier_offers"
  ON product_supplier_offers
  USING (auth.role() = 'authenticated');