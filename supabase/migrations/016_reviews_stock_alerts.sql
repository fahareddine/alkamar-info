-- 016_reviews_stock_alerts.sql
-- Avis clients + alertes retour en stock

-- ── Avis clients ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  author_name text NOT NULL CHECK (char_length(author_name) BETWEEN 2 AND 60),
  email       text,
  rating      int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text CHECK (char_length(comment) <= 2000),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_approved
  ON product_reviews (product_id, created_at DESC) WHERE status = 'approved';

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Lecture publique des avis approuvés uniquement (l'API service_role bypasse RLS)
DROP POLICY IF EXISTS reviews_public_read ON product_reviews;
CREATE POLICY reviews_public_read ON product_reviews
  FOR SELECT USING (status = 'approved');

-- ── Alertes retour en stock ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  email       text NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, email)
);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_pending
  ON stock_alerts (product_id) WHERE notified_at IS NULL;

ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
-- Aucune policy publique : table accessible uniquement via service_role (API)
