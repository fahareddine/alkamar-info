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
    WHERE table_schema = 'public'
    AND table_name = 'products' AND column_name = 'rating'
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
CREATE INDEX IF NOT EXISTS product_tags_tag_id_idx ON product_tags(tag_id);
