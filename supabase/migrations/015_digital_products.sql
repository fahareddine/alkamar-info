-- supabase/migrations/015_digital_products.sql
-- Produits numériques — licences, abonnements, téléchargements
-- ADDITIVE UNIQUEMENT : aucune modification des colonnes existantes

-- ── 1. Extension table products ────────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_digital             BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS product_type           TEXT        NOT NULL DEFAULT 'physical'
    CHECK (product_type IN ('physical','one_time','subscription','license')),
  ADD COLUMN IF NOT EXISTS billing_period         TEXT
    CHECK (billing_period IN ('monthly','yearly') OR billing_period IS NULL),
  ADD COLUMN IF NOT EXISTS max_devices            INT,
  ADD COLUMN IF NOT EXISTS file_path              TEXT,
  ADD COLUMN IF NOT EXISTS file_version           TEXT,
  ADD COLUMN IF NOT EXISTS compatibility          JSONB       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS stripe_price_id        TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT,
  ADD COLUMN IF NOT EXISTS download_limit         INT,
  ADD COLUMN IF NOT EXISTS digital_category       TEXT
    CHECK (digital_category IN (
      'logiciels','abonnements','licences','antivirus',
      'outils-ia','saas','telechargements','premium'
    ) OR digital_category IS NULL);

-- ── 2. Licences numériques ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digital_licenses (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID        REFERENCES orders(id) ON DELETE SET NULL,
  product_id        UUID        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  customer_email    TEXT        NOT NULL,
  license_key       TEXT        UNIQUE NOT NULL,
  max_devices       INT         NOT NULL DEFAULT 1,
  activated_devices JSONB       NOT NULL DEFAULT '[]',
  status            TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','expired','revoked','pending')),
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dlicenses_email   ON digital_licenses(customer_email);
CREATE INDEX IF NOT EXISTS idx_dlicenses_order   ON digital_licenses(order_id);
CREATE INDEX IF NOT EXISTS idx_dlicenses_product ON digital_licenses(product_id);
CREATE INDEX IF NOT EXISTS idx_dlicenses_key     ON digital_licenses(license_key);

-- ── 3. Abonnements numériques ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digital_subscriptions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email         TEXT        NOT NULL,
  product_id             UUID        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  order_id               UUID        REFERENCES orders(id) ON DELETE SET NULL,
  stripe_subscription_id TEXT        UNIQUE,
  status                 TEXT        NOT NULL DEFAULT 'active'
                                     CHECK (status IN ('active','past_due','cancelled','paused','trialing')),
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN     NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dsubs_email   ON digital_subscriptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_dsubs_stripe  ON digital_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_dsubs_product ON digital_subscriptions(product_id);

-- ── 4. Logs de téléchargements ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digital_downloads (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id     UUID        REFERENCES digital_licenses(id) ON DELETE CASCADE,
  customer_email TEXT        NOT NULL,
  product_id     UUID        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  file_version   TEXT,
  downloaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address     TEXT,
  user_agent     TEXT,
  signed_url_id  TEXT
);

CREATE INDEX IF NOT EXISTS idx_ddownloads_license ON digital_downloads(license_id);
CREATE INDEX IF NOT EXISTS idx_ddownloads_email   ON digital_downloads(customer_email);

-- ── 5. Versions logicielles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS software_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version_number  TEXT        NOT NULL,
  file_path       TEXT,
  file_size_bytes BIGINT,
  changelog       TEXT,
  released_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_latest       BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_sversions_product ON software_versions(product_id);

-- ── 6. Index composite produits digitaux ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_digital_cat
  ON products(is_digital, digital_category, status)
  WHERE is_digital = true;

-- ── 7. RLS — service_role uniquement (APIs utilisent la service_role key) ──────
ALTER TABLE digital_licenses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_downloads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE software_versions     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'digital_licenses' AND policyname = 'sr_digital_licenses'
  ) THEN
    CREATE POLICY "sr_digital_licenses" ON digital_licenses
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'digital_subscriptions' AND policyname = 'sr_digital_subscriptions'
  ) THEN
    CREATE POLICY "sr_digital_subscriptions" ON digital_subscriptions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'digital_downloads' AND policyname = 'sr_digital_downloads'
  ) THEN
    CREATE POLICY "sr_digital_downloads" ON digital_downloads
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'software_versions' AND policyname = 'sr_software_versions'
  ) THEN
    CREATE POLICY "sr_software_versions" ON software_versions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
