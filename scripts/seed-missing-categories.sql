-- Catégories manquantes — à exécuter dans Supabase SQL Editor
-- Ces slugs sont référencés par catalog.js mais absents de la table categories

INSERT INTO categories (name, slug, icon, parent_id)
VALUES
  ('Portables reconditionnés',  'reco-portable',    '♻️', NULL),
  ('Bureaux reconditionnés',    'reco-bureau',       '♻️', NULL),
  ('Écrans reconditionnés',     'reco-ecran',        '♻️', NULL),
  ('Smartphones reconditionnés','reco-smartphone',   '♻️', NULL),
  ('Protection & Sécurité',     'protection',        '🛡️', NULL),
  ('Services',                  'service',           '🔧', NULL)
ON CONFLICT (slug) DO NOTHING;
