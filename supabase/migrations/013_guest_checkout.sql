-- supabase/migrations/013_guest_checkout.sql
-- Guest checkout — ajout colonnes sans casser l'existant

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_name         TEXT,
  ADD COLUMN IF NOT EXISTS customer_email        TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone        TEXT,
  ADD COLUMN IF NOT EXISTS customer_whatsapp     TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact     TEXT CHECK (preferred_contact IN ('email','whatsapp','phone')),
  ADD COLUMN IF NOT EXISTS delivery_method       TEXT DEFAULT 'pickup'
    CHECK (delivery_method IN ('pickup','home_delivery')),
  ADD COLUMN IF NOT EXISTS delivery_fee          NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_city         TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address      TEXT,
  ADD COLUMN IF NOT EXISTS delivery_notes        TEXT,
  ADD COLUMN IF NOT EXISTS pickup_location       TEXT DEFAULT 'Boutique Alkamar Moroni',
  ADD COLUMN IF NOT EXISTS subtotal_eur          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payment_method        TEXT DEFAULT 'stripe'
    CHECK (payment_method IN ('stripe','mobile_money','cash_pickup','cash_delivery')),
  ADD COLUMN IF NOT EXISTS payment_status        TEXT DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','awaiting_payment','pending_confirmation','paid','failed','refunded')),
  ADD COLUMN IF NOT EXISTS guest_checkout        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_session_id     TEXT,
  ADD COLUMN IF NOT EXISTS mobile_money_ref      TEXT;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS whatsapp              TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact     TEXT,
  ADD COLUMN IF NOT EXISTS notes_admin           TEXT,
  ADD COLUMN IF NOT EXISTS user_id               UUID;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'pending','confirmed','preparing','ready_for_pickup',
      'out_for_delivery','shipped','delivered','completed','cancelled'
    ));

CREATE INDEX IF NOT EXISTS idx_orders_guest   ON orders(guest_checkout) WHERE guest_checkout = TRUE;
CREATE INDEX IF NOT EXISTS idx_orders_payment ON orders(payment_status);