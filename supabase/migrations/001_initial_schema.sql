-- supabase/migrations/001_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  parent_id   UUID REFERENCES categories(id),
  icon        TEXT,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id   TEXT UNIQUE,
  name        TEXT NOT NULL,
  subtitle    TEXT,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT,
  price_eur   NUMERIC(10,2) NOT NULL,
  price_kmf   NUMERIC(12,0) NOT NULL,
  price_old   NUMERIC(10,2),
  stock       INT DEFAULT 0,
  stock_label TEXT DEFAULT 'En stock',
  status      TEXT DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  category_id UUID REFERENCES categories(id),
  brand       TEXT,
  badge       TEXT,
  badge_class TEXT,
  rating      SMALLINT DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  rating_count INT DEFAULT 0,
  image       TEXT,
  gallery     JSONB DEFAULT '[]',
  features    JSONB DEFAULT '[]',
  specs       JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  city        TEXT,
  island      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  status      TEXT DEFAULT 'pending'
              CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
  total_eur   NUMERIC(10,2) NOT NULL,
  total_kmf   NUMERIC(12,0) NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id),
  quantity         INT NOT NULL CHECK (quantity > 0),
  unit_price_eur   NUMERIC(10,2) NOT NULL,
  unit_price_kmf   NUMERIC(12,0) NOT NULL,
  product_snapshot JSONB NOT NULL
);

CREATE TABLE user_profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT DEFAULT 'editor' CHECK (role IN ('admin','editor','commercial')),
  full_name TEXT
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
