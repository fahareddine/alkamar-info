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
