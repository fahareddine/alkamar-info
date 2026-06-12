-- 017_relances_impayes.sql
-- Relance des commandes Stripe non payées
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_orders_unpaid
  ON orders (created_at DESC)
  WHERE payment_status = 'unpaid';
