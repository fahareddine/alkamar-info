-- supabase/migrations/011_pricing_comoros.sql
-- Systeme de pricing Comores (Phase 1)

-- 1. Parametres globaux (singleton)
CREATE TABLE IF NOT EXISTS pricing_settings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eur_to_kmf_rate             NUMERIC(10,2) DEFAULT 491,
  transport_per_kg_eur        NUMERIC(8,2)  DEFAULT 8,
  fixed_fee_per_product_eur   NUMERIC(8,2)  DEFAULT 5,
  default_customs_rate        NUMERIC(5,4)  DEFAULT 0.15,
  default_local_tax_rate      NUMERIC(5,4)  DEFAULT 0.05,
  default_margin_rate         NUMERIC(5,4)  DEFAULT 0.30,
  minimum_margin_rate         NUMERIC(5,4)  DEFAULT 0.15,
  safety_rate                 NUMERIC(5,4)  DEFAULT 0.05,
  updated_at                  TIMESTAMPTZ   DEFAULT now()
);
INSERT INTO pricing_settings DEFAULT VALUES ON CONFLICT DO NOTHING;

-- 2. Pricing par produit
CREATE TABLE IF NOT EXISTS product_pricing (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  purchase_price              NUMERIC(10,2),
  purchase_currency           TEXT DEFAULT 'EUR',
  supplier_shipping_price     NUMERIC(8,2)  DEFAULT 0,
  weight_kg                   NUMERIC(6,3),
  customs_rate                NUMERIC(5,4),
  local_tax_rate              NUMERIC(5,4),
  target_margin_rate          NUMERIC(5,4),
  risk_rate                   NUMERIC(5,4)  DEFAULT 0.05,
  local_competitor_price_kmf  NUMERIC(12,0),
  total_landed_cost_eur       NUMERIC(10,2),
  recommended_price_eur       NUMERIC(10,2),
  recommended_price_kmf       NUMERIC(12,0),
  final_price_eur             NUMERIC(10,2),
  final_price_kmf             NUMERIC(12,0),
  margin_amount_eur           NUMERIC(10,2),
  margin_rate                 NUMERIC(5,4),
  price_status                TEXT DEFAULT 'pending'
    CHECK (price_status IN ('pending','calculated','validated','manual','to_verify')),
  is_manual_price             BOOLEAN DEFAULT FALSE,
  competitiveness_status      TEXT,
  calculation_details         JSONB,
  pricing_notes               TEXT,
  calculated_at               TIMESTAMPTZ,
  validated_at                TIMESTAMPTZ,
  updated_at                  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id)
);

-- 3. Historique des changements de prix
CREATE TABLE IF NOT EXISTS product_price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price_eur   NUMERIC(10,2),
  old_price_kmf   NUMERIC(12,0),
  new_price_eur   NUMERIC(10,2),
  new_price_kmf   NUMERIC(12,0),
  recommended_eur NUMERIC(10,2),
  source          TEXT,
  pricing_notes   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_pricing_product ON product_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product   ON product_price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created   ON product_price_history(product_id, created_at DESC);

ALTER TABLE pricing_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_pricing       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_pricing_settings"
  ON pricing_settings USING (auth.role() = 'authenticated');
CREATE POLICY "admin_product_pricing"
  ON product_pricing USING (auth.role() = 'authenticated');
CREATE POLICY "admin_price_history"
  ON product_price_history USING (auth.role() = 'authenticated');