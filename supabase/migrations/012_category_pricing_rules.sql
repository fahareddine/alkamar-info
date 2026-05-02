-- supabase/migrations/012_category_pricing_rules.sql
-- Regles de marge par categorie

CREATE TABLE IF NOT EXISTS category_pricing_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id         UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  default_margin_rate NUMERIC(5,4) DEFAULT 0.30,
  min_margin_rate     NUMERIC(5,4) DEFAULT 0.15,
  customs_rate        NUMERIC(5,4),
  local_tax_rate      NUMERIC(5,4),
  transport_multiplier NUMERIC(5,2) DEFAULT 1.0,
  risk_rate           NUMERIC(5,4) DEFAULT 0.05,
  notes               TEXT,
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id)
);

-- Valeurs par defaut intelligentes par categorie
-- (les IDs viennent de la BDD Alkamar)
INSERT INTO category_pricing_rules (category_id, default_margin_rate, min_margin_rate, notes)
VALUES
  -- Accessoires petits (marge haute 40-50%)
  ('746fd402-03a0-4408-8b90-895d4da85cf0', 0.45, 0.30, 'Cables reseau - petits'),
  ('58a37f7a-3ffa-4424-8ad0-b49565a27cf2', 0.45, 0.30, 'Cles USB'),
  ('ab0211a0-b741-4937-8e6b-be08cd50a652', 0.45, 0.30, 'Cartes memoire'),
  ('cc70f942-33c3-4413-9c5c-4feee8a0889f', 0.40, 0.25, 'Casques enceintes'),
  ('b11ce616-9bdc-4dc6-93d6-1cdaed7169e6', 0.40, 0.25, 'Claviers'),
  ('bb2de14c-815e-411a-9d6a-ba0039b9bd64', 0.40, 0.25, 'Souris'),
  ('1cde3e1f-d1f4-45ff-b5ce-7ce2614ac11c', 0.40, 0.25, 'Webcams'),
  ('e8adc936-6a80-467a-8064-7826f6cd88d7', 0.40, 0.25, 'Essentiels montage'),
  ('341cfce3-f189-44a0-90e4-7ceb20940186', 0.40, 0.25, 'Essentiels perif'),
  -- Composants (marge medio-haute 30-40%)
  ('83a0240a-fd4b-4eb3-952e-8549a095dc75', 0.35, 0.20, 'RAM - leger'),
  ('0c033a86-5a59-488d-afeb-00d7e3af66eb', 0.35, 0.20, 'GPU - lourd'),
  ('2d505c13-00d6-416c-bcac-2012ce9495ae', 0.35, 0.20, 'Alimentations'),
  ('6a1f6ed0-4c31-47cf-a590-b834ce39e27d', 0.35, 0.20, 'Boitiers PC - lourd'),
  ('f717bd64-897a-46eb-a838-aa26e2150075', 0.35, 0.20, 'Refroidissement'),
  ('7230d5cb-22bc-44a1-bccf-4141dd61b102', 0.35, 0.20, 'Cartes meres'),
  ('852b75ca-91d2-4859-bae3-4032b73d4186', 0.35, 0.20, 'CPU'),
  ('5a440d19-6053-4b66-97df-e7ea598b6895', 0.35, 0.20, 'Onduleurs - lourd'),
  -- Ecrans (marge moyenne 25-35%)
  ('974b414b-6cba-42e6-9881-0cfa74f40364', 0.30, 0.18, 'Ecrans generique'),
  ('1165decd-a7e6-4895-b8d2-eae2f0287bc8', 0.30, 0.18, 'Ecrans FHD'),
  ('115ac7c3-8111-474d-ae62-b006ee56cd9d', 0.30, 0.18, 'Ecrans FHD'),
  ('7802d508-6f05-4055-a729-684712b1e202', 0.32, 0.20, 'Ecrans Gaming'),
  -- Stockage (marge 25-35%)
  ('c6a2c6e6-7641-4a71-8326-6e6988cd0b91', 0.32, 0.20, 'SSD externe'),
  ('316e2d66-4bfc-4df3-a6bc-a5d74cd80e29', 0.30, 0.18, 'SSD interne'),
  ('118ff878-eb86-4f72-b256-5d780480e142', 0.30, 0.18, 'HDD'),
  ('6a6dffeb-dc65-498d-bf6f-8e17a1e2ccc0', 0.35, 0.20, 'NAS - reseau'),
  -- Reseau (marge 30-40%)
  ('0c45de00-d9ae-4faa-8efe-c43fd4e8f29a', 0.38, 0.25, 'Routeurs 4G/5G - demande forte'),
  ('34fa9f24-4816-47ae-9812-87bcad4cfd9c', 0.35, 0.22, 'Routeurs WiFi'),
  ('c4126bdd-ec21-4012-b713-548c85847921', 0.35, 0.22, 'Switches'),
  ('31b860d5-f9c3-420f-90ea-4b1e8a6c79d9', 0.35, 0.22, 'Points acces'),
  -- Imprimantes (marge moyenne 25-35%)
  ('2c140a0b-a7b1-4e2a-8331-51d721f09a1d', 0.30, 0.18, 'Imprimantes generique'),
  ('0029d2b4-b4bc-4792-97ee-2253b6b701e4', 0.30, 0.18, 'Jet encre'),
  ('806b3473-646a-489f-adbb-d37b81bbe50b', 0.30, 0.18, 'Laser'),
  -- Ordinateurs (marge basse 20-28% - montant eleve)
  ('b346b5f7-d30f-47e0-a758-725b34edfc5b', 0.25, 0.15, 'PC Portables - valeur haute'),
  ('ec6079fa-4a60-4e6a-8958-f6c1a1e3be3b', 0.25, 0.15, 'PC Bureau'),
  ('36ceb34c-5641-4f32-9977-8738d8f69178', 0.28, 0.18, 'PC Gaming'),
  ('a1d8966f-f2b8-4c93-b25f-41848dcb9c60', 0.25, 0.15, 'PC Tout-en-un'),
  ('88a48d0e-9065-451e-86d4-6d4bc116c4e0', 0.28, 0.18, 'Mini PC'),
  -- Reconditionnes (marge 20-30%)
  ('870b6dbf-7a0b-450c-8b61-09523caee6ac', 0.30, 0.18, 'Reconditiones Grade A'),
  ('d3378982-1a64-4ee5-a79b-eb946679db73', 0.28, 0.15, 'Portables reco'),
  ('67ec557a-4fd1-41dc-87ce-708327b8e000', 0.28, 0.15, 'Bureaux reco')
ON CONFLICT (category_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_category_pricing_cat ON category_pricing_rules(category_id);

ALTER TABLE category_pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_category_pricing"
  ON category_pricing_rules USING (auth.role() = 'authenticated');