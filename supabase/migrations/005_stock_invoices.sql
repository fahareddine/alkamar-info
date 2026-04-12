-- supabase/migrations/005_stock_invoices.sql

-- 1. Mouvements de stock
CREATE TABLE IF NOT EXISTS stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES products(id),
  type           TEXT NOT NULL CHECK (type IN ('in','out','adjustment','return')),
  quantity       INT NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('order','manual','supplier','return')),
  reference_id   UUID,
  note           TEXT,
  created_by     UUID REFERENCES user_profiles(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON stock_movements(created_at DESC);

-- 2. Trigger synchronisation products.stock
CREATE OR REPLACE FUNCTION sync_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type IN ('in', 'return') THEN
    UPDATE products SET stock = stock + ABS(NEW.quantity) WHERE id = NEW.product_id;
  ELSIF NEW.type = 'out' THEN
    UPDATE products SET stock = stock - ABS(NEW.quantity) WHERE id = NEW.product_id;
  ELSE
    -- adjustment : quantity signé (+N ou -N)
    UPDATE products SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stock_movements_sync
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION sync_product_stock();

-- 3. Séquence + fonction numérotation factures
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'FAC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_seq')::TEXT, 4, '0');
END;
$$;

-- 4. Table factures
CREATE TABLE IF NOT EXISTS invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL DEFAULT next_invoice_number(),
  order_id       UUID NOT NULL REFERENCES orders(id),
  customer_id    UUID NOT NULL REFERENCES customers(id),
  issued_at      TIMESTAMPTZ DEFAULT now(),
  due_at         TIMESTAMPTZ,
  total_eur      NUMERIC(10,2) NOT NULL,
  total_kmf      NUMERIC(12,0) NOT NULL,
  discount_eur   NUMERIC(10,2) DEFAULT 0,
  tax_rate       NUMERIC(5,2) DEFAULT 0,
  status         TEXT DEFAULT 'issued'
                 CHECK (status IN ('issued','paid','cancelled')),
  pdf_url        TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_order_idx ON invoices(order_id);
CREATE INDEX IF NOT EXISTS invoices_customer_idx ON invoices(customer_id);
