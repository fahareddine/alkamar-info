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
