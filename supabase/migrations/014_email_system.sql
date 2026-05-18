-- ── Migration 014 : Système emails transactionnels ───────────────────────────
-- Tables : contacts, email_logs
-- RLS : admin/commercial pour lecture, public pour insertion (contacts)

-- ── Table contacts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  email      TEXT,
  phone      TEXT,
  subject    TEXT,
  message    TEXT        NOT NULL,
  source     TEXT        NOT NULL DEFAULT 'boutique',
  status     TEXT        NOT NULL DEFAULT 'new'
             CHECK (status IN ('new', 'read', 'replied', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Insertion publique (formulaire de contact)
CREATE POLICY "contacts_public_insert" ON contacts
  FOR INSERT WITH CHECK (true);

-- Lecture/mise à jour admin et commercial
CREATE POLICY "contacts_admin_select" ON contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('admin', 'commercial')
    )
  );

CREATE POLICY "contacts_admin_update" ON contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('admin', 'commercial')
    )
  );

CREATE INDEX IF NOT EXISTS contacts_email_idx      ON contacts (email);
CREATE INDEX IF NOT EXISTS contacts_created_at_idx ON contacts (created_at DESC);
CREATE INDEX IF NOT EXISTS contacts_status_idx     ON contacts (status);

-- ── Table email_logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type          TEXT        NOT NULL,
  recipient_email     TEXT,
  subject             TEXT,
  status              TEXT        NOT NULL DEFAULT 'sent'
                      CHECK (status IN ('sent', 'failed', 'skipped', 'bounced')),
  provider_message_id TEXT,
  related_order_id    UUID        REFERENCES orders(id)   ON DELETE SET NULL,
  related_contact_id  UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Lecture admin uniquement
CREATE POLICY "email_logs_admin_select" ON email_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

-- Insertion via service_role uniquement (API serverless)
CREATE POLICY "email_logs_service_insert" ON email_logs
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS email_logs_event_type_idx   ON email_logs (event_type);
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx   ON email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_order_id_idx     ON email_logs (related_order_id);
CREATE INDEX IF NOT EXISTS email_logs_contact_id_idx   ON email_logs (related_contact_id);
CREATE INDEX IF NOT EXISTS email_logs_status_idx       ON email_logs (status);
