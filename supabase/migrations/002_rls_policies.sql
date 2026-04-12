-- supabase/migrations/002_rls_policies.sql

ALTER TABLE categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_public_read" ON categories
  FOR SELECT USING (true);

CREATE POLICY "products_public_read" ON products
  FOR SELECT USING (status = 'active');

CREATE POLICY "user_profiles_self" ON user_profiles
  FOR SELECT USING (auth.uid() = id);
