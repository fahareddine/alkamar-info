# Backend + Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le catalogue statique `products.js` par une API Vercel + base de données Supabase, et créer un back-office admin complet (CRUD produits, commandes, clients, stats).

**Architecture:** Vercel Serverless Functions (`/api/*`) en Node.js CJS pour la couche API, Supabase PostgreSQL pour le stockage, Supabase Auth pour l'authentification admin multi-rôles. Le site public passe de la lecture de `products.js` à `fetch('/api/products')`. L'admin panel est un ensemble de pages HTML/JS vanilla dans `/admin/`.

**Tech Stack:** Node.js (CJS) · @supabase/supabase-js v2 · Supabase PostgreSQL + Auth + Storage · Vercel Serverless Functions · HTML/CSS/JS vanilla

---

## File Map

### Nouveaux fichiers

```
package.json                          ← dépendances API (supabase-js)
.env.local                            ← clés Supabase (local dev)

api/
  _lib/
    supabase.js                       ← client Supabase admin (service role)
    auth.js                           ← vérification JWT + rôle
    cors.js                           ← headers CORS
  products.js                         ← GET list + POST
  products/[id].js                    ← GET detail + PUT + DELETE
  categories.js                       ← GET list + POST
  categories/[id].js                  ← PUT + DELETE
  orders.js                           ← GET list + POST
  orders/[id].js                      ← GET detail + PUT
  customers.js                        ← GET list
  stats.js                            ← GET dashboard stats

supabase/
  migrations/
    001_initial_schema.sql            ← tables + contraintes
    002_rls_policies.sql              ← policies Row Level Security
  seed/
    migrate_products.js               ← script one-shot : products.js → Supabase

admin/
  css/admin.css                       ← styles back-office
  js/
    config.js                         ← clés publiques Supabase (anon key)
    api.js                            ← fetch wrapper avec Authorization header
    auth.js                           ← login/logout/guard
    layout.js                         ← sidebar injectée dans chaque page
    dashboard.js                      ← widgets stats
    products-list.js                  ← liste + filtres produits
    product-edit.js                   ← formulaire ajout/édition
    orders-list.js                    ← liste commandes
    order-detail.js                   ← détail + changement statut
    customers.js                      ← liste clients
    categories.js                     ← gestion catégories
    users.js                          ← gestion utilisateurs
  index.html                          ← dashboard
  login.html                          ← authentification
  products/
    index.html                        ← liste produits
    edit.html                         ← formulaire produit
  orders/
    index.html                        ← liste commandes
    detail.html                       ← détail commande
  customers/index.html
  categories/index.html
  users/index.html
```

### Fichiers modifiés

```
ordinateurs.html    ← remplacer lecture PRODUCTS[] par fetch('/api/products')
produit.html        ← idem + fetch produit unique par id
index.html          ← fetch produits featured/promo depuis API
```

---

## Phase 0 : Fondations

### Task 1 : Setup projet + variables d'environnement

**Files:**
- Create: `package.json`
- Create: `.env.local`
- Create: `.gitignore` (ajouter .env.local)

- [ ] **Step 1 : Créer le projet Supabase**

  Aller sur https://supabase.com → New project → noter :
  - `Project URL` (ex: `https://xxxx.supabase.co`)
  - `anon public` key
  - `service_role` key (Settings → API)

- [ ] **Step 2 : Créer `package.json`**

```json
{
  "name": "alkamar-info",
  "version": "1.0.0",
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0"
  }
}
```

- [ ] **Step 3 : Créer `.env.local`**

```
SUPABASE_URL=https://VOTRE_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
```

- [ ] **Step 4 : Vérifier `.gitignore` contient `.env.local`**

  Si absent, ajouter la ligne `.env.local` au fichier `.gitignore`.

- [ ] **Step 5 : Installer les dépendances**

```bash
npm install
```

  Attendu : création de `node_modules/` et `package-lock.json`.

- [ ] **Step 6 : Ajouter les env vars sur Vercel**

```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

  Sélectionner `Production`, `Preview` et `Development` pour chacune.

- [ ] **Step 7 : Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "feat: add package.json with supabase-js dependency"
```

---

### Task 2 : Schéma base de données

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1 : Créer le fichier SQL**

```sql
-- supabase/migrations/001_initial_schema.sql

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Catégories (hiérarchie parent/enfant)
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  parent_id   UUID REFERENCES categories(id),
  icon        TEXT,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Produits
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id   TEXT UNIQUE,              -- id string de products.js (ex: 'lenovo-ideapad-3')
  name        TEXT NOT NULL,
  subtitle    TEXT,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT,
  price_eur   NUMERIC(10,2) NOT NULL,
  price_kmf   NUMERIC(12,0) NOT NULL,
  price_old   NUMERIC(10,2),
  stock       INT DEFAULT 0,
  stock_label TEXT DEFAULT 'En stock',
  status      TEXT DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  category_id UUID REFERENCES categories(id),
  brand       TEXT,
  badge       TEXT,
  badge_class TEXT,
  rating      SMALLINT DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  rating_count INT DEFAULT 0,
  image       TEXT,
  gallery     JSONB DEFAULT '[]',
  features    JSONB DEFAULT '[]',
  specs       JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Clients
CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  city        TEXT,
  island      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Commandes
CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  status      TEXT DEFAULT 'pending'
              CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
  total_eur   NUMERIC(10,2) NOT NULL,
  total_kmf   NUMERIC(12,0) NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Lignes de commande
CREATE TABLE order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id),
  quantity         INT NOT NULL CHECK (quantity > 0),
  unit_price_eur   NUMERIC(10,2) NOT NULL,
  unit_price_kmf   NUMERIC(12,0) NOT NULL,
  product_snapshot JSONB NOT NULL
);

-- Profils utilisateurs admin (extension de auth.users)
CREATE TABLE user_profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT DEFAULT 'editor' CHECK (role IN ('admin','editor','commercial')),
  full_name TEXT
);

-- Trigger updated_at auto
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 2 : Appliquer le schéma dans Supabase**

  Dans le dashboard Supabase → SQL Editor → coller le contenu du fichier → Run.

  Vérifier : onglet Table Editor doit montrer 6 tables : `categories`, `products`, `customers`, `orders`, `order_items`, `user_profiles`.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: initial Supabase schema — 6 tables"
```

---

### Task 3 : RLS Policies

**Files:**
- Create: `supabase/migrations/002_rls_policies.sql`

- [ ] **Step 1 : Créer le fichier SQL**

```sql
-- supabase/migrations/002_rls_policies.sql

-- Active RLS sur toutes les tables
ALTER TABLE categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- CATEGORIES : lecture publique
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT USING (true);

-- PRODUCTS : lecture publique des produits actifs
CREATE POLICY "products_public_read" ON products
  FOR SELECT USING (status = 'active');

-- PRODUCTS : toutes opérations via service_role (API serverless)
-- Note: les serverless functions utilisent service_role, RLS contournée côté serveur
-- Les policies ci-dessus protègent les accès directs (Supabase JS SDK depuis navigateur)

-- USER_PROFILES : l'utilisateur voit uniquement son profil
CREATE POLICY "user_profiles_self" ON user_profiles
  FOR SELECT USING (auth.uid() = id);
```

- [ ] **Step 2 : Appliquer dans Supabase**

  SQL Editor → coller → Run.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/002_rls_policies.sql
git commit -m "feat: Supabase RLS policies"
```

---

### Task 4 : Librairie partagée API

**Files:**
- Create: `api/_lib/supabase.js`
- Create: `api/_lib/auth.js`
- Create: `api/_lib/cors.js`

- [ ] **Step 1 : Créer `api/_lib/supabase.js`**

```javascript
// api/_lib/supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = { supabase };
```

- [ ] **Step 2 : Créer `api/_lib/auth.js`**

```javascript
// api/_lib/auth.js
const { createClient } = require('@supabase/supabase-js');

/**
 * Vérifie le JWT dans Authorization header et contrôle le rôle.
 * @param {object} req - requête Vercel
 * @param {...string} allowedRoles - ex: 'admin', 'editor'
 * @returns {{ user, role } | { error, status }}
 */
async function requireRole(req, ...allowedRoles) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!token) return { error: 'Unauthorized', status: 401 };

  // Vérifier le token avec le client anon (validé par Supabase Auth)
  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return { error: 'Unauthorized', status: 401 };

  // Récupérer le rôle depuis user_profiles (avec service_role pour bypasser RLS)
  const { supabase } = require('./supabase');
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) return { error: 'Forbidden', status: 403 };
  if (!allowedRoles.includes(profile.role)) return { error: 'Forbidden', status: 403 };

  return { user, role: profile.role };
}

module.exports = { requireRole };
```

- [ ] **Step 3 : Créer `api/_lib/cors.js`**

```javascript
// api/_lib/cors.js
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

module.exports = { setCors };
```

- [ ] **Step 4 : Commit**

```bash
git add api/_lib/
git commit -m "feat: API lib — supabase client, auth helper, cors"
```

---

### Task 5 : Endpoint GET /api/products + POST

**Files:**
- Create: `api/products.js`

- [ ] **Step 1 : Créer `api/products.js`**

```javascript
// api/products.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — lecture publique avec filtres
  if (req.method === 'GET') {
    const { category, subcategory, status, search, limit = '100', offset = '0' } = req.query;

    let query = supabase
      .from('products')
      .select(`
        id, legacy_id, name, subtitle, slug, description,
        price_eur, price_kmf, price_old, stock, stock_label, status,
        brand, badge, badge_class, rating, rating_count,
        image, gallery, features, specs, created_at,
        categories(id, name, slug, parent_id, icon)
      `)
      .order('name');

    // Filtre statut : par défaut 'active', sauf si l'appelant demande explicitement 'all'
    if (status === 'all') {
      // pas de filtre statut — admin uniquement, géré par l'appelant
    } else {
      query = query.eq('status', status || 'active');
    }

    if (category) query = query.eq('category_id', category);
    if (subcategory) {
      // Filtre via la table categories sur le slug
      query = query.eq('categories.slug', subcategory);
    }
    if (search) query = query.ilike('name', `%${search}%`);

    query = query.range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST — créer un produit (admin ou editor)
  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { data, error } = await supabase
      .from('products')
      .insert(req.body)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
```

- [ ] **Step 2 : Tester en local avec Vercel CLI**

```bash
npx vercel dev
```

  Dans un autre terminal :

```bash
curl http://localhost:3000/api/products
```

  Attendu : `[]` (tableau vide — DB vide pour l'instant). Code HTTP 200.

- [ ] **Step 3 : Commit**

```bash
git add api/products.js
git commit -m "feat: GET+POST /api/products endpoint"
```

---

### Task 6 : Endpoint /api/products/[id]

**Files:**
- Create: `api/products/[id].js`

- [ ] **Step 1 : Créer `api/products/[id].js`**

```javascript
// api/products/[id].js
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  // GET — lecture publique par id UUID ou legacy_id string
  if (req.method === 'GET') {
    const isUUID = /^[0-9a-f-]{36}$/.test(id);
    let query = supabase
      .from('products')
      .select(`*, categories(id, name, slug, parent_id, icon)`)
      .single();

    if (isUUID) {
      query = supabase.from('products').select(`*, categories(id, name, slug, parent_id, icon)`).eq('id', id).single();
    } else {
      query = supabase.from('products').select(`*, categories(id, name, slug, parent_id, icon)`).eq('legacy_id', id).single();
    }

    const { data, error } = await query;
    if (error) return res.status(404).json({ error: 'Produit introuvable' });
    return res.status(200).json(data);
  }

  // PUT — modifier (admin ou editor)
  if (req.method === 'PUT') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { data, error } = await supabase
      .from('products')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // DELETE — archiver (admin uniquement — on ne supprime pas, on archive)
  if (req.method === 'DELETE') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { error } = await supabase
      .from('products')
      .update({ status: 'archived' })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ archived: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
```

- [ ] **Step 2 : Tester**

```bash
curl http://localhost:3000/api/products/lenovo-ideapad-3
```

  Attendu : `{"error":"Produit introuvable"}` — normal, DB vide. Code 404.

- [ ] **Step 3 : Commit**

```bash
git add api/products/
git commit -m "feat: GET+PUT+DELETE /api/products/:id"
```

---

### Task 7 : Endpoints secondaires (categories, orders, customers, stats)

**Files:**
- Create: `api/categories.js`
- Create: `api/categories/[id].js`
- Create: `api/orders.js`
- Create: `api/orders/[id].js`
- Create: `api/customers.js`
- Create: `api/stats.js`

- [ ] **Step 1 : Créer `api/categories.js`**

```javascript
// api/categories.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { data, error } = await supabase.from('categories').insert(req.body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
```

- [ ] **Step 2 : Créer `api/categories/[id].js`**

```javascript
// api/categories/[id].js
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { id } = req.query;

  if (req.method === 'PUT') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { data, error } = await supabase.from('categories').update(req.body).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ deleted: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
```

- [ ] **Step 3 : Créer `api/orders.js`**

```javascript
// api/orders.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { status, limit = '50', offset = '0' } = req.query;
    let query = supabase
      .from('orders')
      .select('*, customers(name, email, phone), order_items(*, products(name, image))')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { customer, items, notes } = req.body;

    // Upsert client
    let customerId;
    if (customer.id) {
      customerId = customer.id;
    } else {
      const { data: c, error: ce } = await supabase
        .from('customers').insert(customer).select('id').single();
      if (ce) return res.status(500).json({ error: ce.message });
      customerId = c.id;
    }

    // Calculer totaux
    const total_eur = items.reduce((s, i) => s + i.unit_price_eur * i.quantity, 0);
    const total_kmf = items.reduce((s, i) => s + i.unit_price_kmf * i.quantity, 0);

    const { data: order, error: oe } = await supabase
      .from('orders')
      .insert({ customer_id: customerId, total_eur, total_kmf, notes })
      .select('id').single();
    if (oe) return res.status(500).json({ error: oe.message });

    const orderItems = items.map(i => ({ ...i, order_id: order.id }));
    const { error: ie } = await supabase.from('order_items').insert(orderItems);
    if (ie) return res.status(500).json({ error: ie.message });

    return res.status(201).json({ id: order.id });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
```

- [ ] **Step 4 : Créer `api/orders/[id].js`**

```javascript
// api/orders/[id].js
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { id } = req.query;

  if (req.method === 'GET') {
    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { data, error } = await supabase
      .from('orders')
      .select('*, customers(*), order_items(*, products(name, image, price_eur))')
      .eq('id', id)
      .single();
    if (error) return res.status(404).json({ error: 'Commande introuvable' });
    return res.status(200).json(data);
  }

  if (req.method === 'PUT') {
    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { data, error } = await supabase
      .from('orders')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
```

- [ ] **Step 5 : Créer `api/customers.js`**

```javascript
// api/customers.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireRole(req, 'admin', 'commercial');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  if (req.method === 'GET') {
    const { search, limit = '50', offset = '0' } = req.query;
    let query = supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
```

- [ ] **Step 6 : Créer `api/stats.js`**

```javascript
// api/stats.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [ordersMonth, ordersTotal, stockAlert, recentOrders] = await Promise.all([
    // CA du mois
    supabase.from('orders')
      .select('total_eur, total_kmf')
      .gte('created_at', startOfMonth)
      .neq('status', 'cancelled'),
    // Total commandes
    supabase.from('orders').select('id, status', { count: 'exact' }),
    // Produits stock faible (< 3)
    supabase.from('products')
      .select('id, name, stock')
      .lt('stock', 3)
      .eq('status', 'active')
      .order('stock'),
    // 10 dernières commandes
    supabase.from('orders')
      .select('id, status, total_eur, total_kmf, created_at, customers(name)')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const ca_eur = (ordersMonth.data || []).reduce((s, o) => s + Number(o.total_eur), 0);
  const ca_kmf = (ordersMonth.data || []).reduce((s, o) => s + Number(o.total_kmf), 0);
  const pending = (ordersTotal.data || []).filter(o => o.status === 'pending').length;

  return res.status(200).json({
    ca: { eur: ca_eur, kmf: ca_kmf },
    orders: { total: ordersTotal.count || 0, pending },
    stock_alerts: stockAlert.data || [],
    recent_orders: recentOrders.data || [],
  });
};
```

- [ ] **Step 7 : Commit**

```bash
git add api/
git commit -m "feat: API endpoints — categories, orders, customers, stats"
```

---

### Task 8 : Script de migration products.js → Supabase

**Files:**
- Create: `supabase/seed/migrate_products.js`

- [ ] **Step 1 : Créer le script**

```javascript
// supabase/seed/migrate_products.js
// Usage: node supabase/seed/migrate_products.js
// Prérequis: npm install && .env.local configuré

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Charger products.js et extraire PRODUCTS
const src = fs.readFileSync(path.join(__dirname, '../../js/products.js'), 'utf8');
const fn = new Function(src + '\nreturn PRODUCTS;');
const PRODUCTS = fn();

// Mapping subcategory → { parent, cat }
const SUBCATEGORY_MAP = {
  portables:       { parent: 'ordinateurs', label: 'PC Portables', icon: '💻', sort: 1 },
  bureau:          { parent: 'ordinateurs', label: 'PC de Bureau', icon: '🖥️', sort: 2 },
  gaming:          { parent: 'ordinateurs', label: 'PC Gaming', icon: '🎮', sort: 3 },
  toutunun:        { parent: 'ordinateurs', label: 'PC Tout-en-un', icon: '📺', sort: 4 },
  reconditiones:   { parent: 'ordinateurs', label: 'Reconditionnés Grade A', icon: '♻️', sort: 5 },
  minipc:          { parent: 'ordinateurs', label: 'Mini PC', icon: '📦', sort: 6 },
  cpu:             { parent: 'composants',  label: 'Processeurs CPU', icon: '🔲', sort: 1 },
  cartemere:       { parent: 'composants',  label: 'Cartes mères', icon: '🖥️', sort: 2 },
  ram:             { parent: 'composants',  label: 'RAM / Mémoire', icon: '💾', sort: 3 },
  gpu:             { parent: 'composants',  label: 'Cartes graphiques GPU', icon: '🎮', sort: 4 },
  alimentation:    { parent: 'composants',  label: 'Alimentations', icon: '⚡', sort: 5 },
  boitier:         { parent: 'composants',  label: 'Boîtiers PC', icon: '📦', sort: 6 },
  refroidissement: { parent: 'composants',  label: 'Refroidissement', icon: '❄️', sort: 7 },
  clavier:         { parent: 'peripheriques', label: 'Claviers', icon: '⌨️', sort: 1 },
  souris:          { parent: 'peripheriques', label: 'Souris', icon: '🖱️', sort: 2 },
  casque:          { parent: 'peripheriques', label: 'Casques / Enceintes', icon: '🎧', sort: 3 },
  webcam:          { parent: 'peripheriques', label: 'Webcams', icon: '📷', sort: 4 },
  imprimante:      { parent: 'peripheriques', label: 'Imprimantes', icon: '🖨️', sort: 5 },
  onduleur:        { parent: 'peripheriques', label: 'Onduleurs', icon: '🔋', sort: 6 },
  'routeur-wifi':  { parent: 'reseau', label: 'Routeurs WiFi', icon: '📡', sort: 1 },
  'routeur-4g5g':  { parent: 'reseau', label: 'Routeurs 4G/5G', icon: '📶', sort: 2 },
  switch:          { parent: 'reseau', label: 'Switches', icon: '🔀', sort: 3 },
  'point-acces':   { parent: 'reseau', label: "Points d'accès", icon: '📡', sort: 4 },
  cable:           { parent: 'reseau', label: 'Câbles réseau', icon: '🔌', sort: 5 },
  'ssd-externe':   { parent: 'stockage', label: 'SSD Externes', icon: '💽', sort: 1 },
  'ssd-interne':   { parent: 'stockage', label: 'SSD Internes', icon: '💾', sort: 2 },
  hdd:             { parent: 'stockage', label: 'Disques durs HDD', icon: '🗄️', sort: 3 },
  'cle-usb':       { parent: 'stockage', label: 'Clés USB', icon: '🔑', sort: 4 },
  'carte-memoire': { parent: 'stockage', label: 'Cartes mémoire', icon: '📱', sort: 5 },
  nas:             { parent: 'stockage', label: 'NAS', icon: '🖥️', sort: 6 },
  'ecran-fhd':     { parent: 'ecrans', label: 'Écrans Full HD', icon: '🖥️', sort: 1 },
  'ecran-4k':      { parent: 'ecrans', label: 'Écrans 4K', icon: '🔲', sort: 2 },
  'ecran-gaming':  { parent: 'ecrans', label: 'Écrans Gaming', icon: '🎮', sort: 3 },
  'ecran-reco':    { parent: 'ecrans', label: 'Écrans reconditionnés', icon: '♻️', sort: 4 },
};

const PARENT_CATS = ['ordinateurs', 'composants', 'peripheriques', 'reseau', 'stockage', 'ecrans'];

async function run() {
  console.log(`Chargé ${PRODUCTS.length} produits depuis products.js`);

  // 1. Insérer catégories parentes
  const parentInserts = PARENT_CATS.map((slug, i) => ({
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    slug,
    sort_order: i,
  }));
  const { data: parents, error: pe } = await supabase
    .from('categories').upsert(parentInserts, { onConflict: 'slug' }).select();
  if (pe) { console.error('Erreur catégories parentes:', pe.message); process.exit(1); }
  console.log(`✓ ${parents.length} catégories parentes`);

  const parentMap = Object.fromEntries(parents.map(p => [p.slug, p.id]));

  // 2. Insérer sous-catégories
  const subInserts = Object.entries(SUBCATEGORY_MAP).map(([slug, info]) => ({
    name: info.label, slug, icon: info.icon, sort_order: info.sort,
    parent_id: parentMap[info.parent],
  }));
  const { data: subs, error: se } = await supabase
    .from('categories').upsert(subInserts, { onConflict: 'slug' }).select();
  if (se) { console.error('Erreur sous-catégories:', se.message); process.exit(1); }
  console.log(`✓ ${subs.length} sous-catégories`);

  const subMap = Object.fromEntries(subs.map(s => [s.slug, s.id]));

  // 3. Insérer produits
  const productRows = PRODUCTS.map(p => {
    // Normaliser gallery en [{src, alt}]
    const gallery = (p.gallery || []).map(item =>
      typeof item === 'string' ? { src: item, alt: '' } : item
    );
    return {
      legacy_id: p.id,
      name: p.name,
      subtitle: p.subtitle || null,
      slug: p.id,
      description: p.description || null,
      price_eur: p.price,
      price_kmf: p.priceKmf,
      price_old: p.priceOld || null,
      stock: p.stock === 'En stock' ? 10 : p.stock === 'Rupture de stock' ? 0 : 5,
      stock_label: typeof p.stock === 'string' ? p.stock : 'En stock',
      status: 'active',
      category_id: subMap[p.subcategory] || null,
      brand: p.brand || null,
      badge: p.badge || null,
      badge_class: p.badgeClass || null,
      rating: p.rating || 0,
      rating_count: p.ratingCount || 0,
      image: p.image || null,
      gallery,
      features: p.features || [],
      specs: p.specs || {},
    };
  });

  // Insérer par batch de 50
  let inserted = 0;
  for (let i = 0; i < productRows.length; i += 50) {
    const batch = productRows.slice(i, i + 50);
    const { error: prodErr } = await supabase
      .from('products').upsert(batch, { onConflict: 'legacy_id' });
    if (prodErr) { console.error(`Erreur batch ${i}:`, prodErr.message); process.exit(1); }
    inserted += batch.length;
    console.log(`  → ${inserted}/${productRows.length} produits insérés`);
  }

  console.log(`\n✅ Migration terminée : ${PRODUCTS.length} produits dans Supabase`);
}

run().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2 : Installer dotenv (pour le script local)**

```bash
npm install --save-dev dotenv
```

- [ ] **Step 3 : Lancer le script**

```bash
node supabase/seed/migrate_products.js
```

  Attendu :
  ```
  Chargé 226 produits depuis products.js
  ✓ 6 catégories parentes
  ✓ 38 sous-catégories
    → 50/226 produits insérés
    → 100/226 produits insérés
    → 150/226 produits insérés
    → 200/226 produits insérés
    → 226/226 produits insérés

  ✅ Migration terminée : 226 produits dans Supabase
  ```

- [ ] **Step 4 : Vérifier dans Supabase**

  Dashboard Supabase → Table Editor → `products` → doit montrer 226 lignes.

- [ ] **Step 5 : Tester l'API**

```bash
curl "http://localhost:3000/api/products?limit=3" | python -m json.tool
```

  Attendu : tableau JSON avec 3 produits complets.

```bash
curl "http://localhost:3000/api/products/lenovo-ideapad-3"
```

  Attendu : objet JSON du produit Lenovo IdeaPad 3.

- [ ] **Step 6 : Commit**

```bash
git add supabase/ package.json package-lock.json
git commit -m "feat: migration script products.js → Supabase (226 produits)"
```

---

## Phase 1 : Basculement frontend

### Task 9 : ordinateurs.html — lecture depuis l'API

**Files:**
- Modify: `ordinateurs.html`

- [ ] **Step 1 : Lire la section JS de chargement dans ordinateurs.html**

  Identifier la portion du script qui lit `PRODUCTS` (filtre par subcategory, rend les cards).

- [ ] **Step 2 : Remplacer la lecture PRODUCTS[] par fetch API**

  Trouver le bloc :
  ```javascript
  const filtered = PRODUCTS.filter(p => p.subcategory === activeTab);
  ```

  Remplacer par :
  ```javascript
  async function loadProducts(tab) {
    const res = await fetch(`/api/products?subcategory=${tab}&status=active`);
    if (!res.ok) { console.error('Erreur API', res.status); return []; }
    return res.json();
  }
  ```

  Et adapter l'appel de rendu pour être `async` :
  ```javascript
  const products = await loadProducts(activeTab);
  renderCards(products);
  ```

- [ ] **Step 3 : Supprimer le `<script src="js/products.js">` de ordinateurs.html**

  La balise `<script src="js/products.js">` n'est plus nécessaire sur cette page.
  La supprimer pour éviter de charger 261 Ko inutilement.

- [ ] **Step 4 : Vérifier dans le navigateur**

```bash
npx vercel dev
```

  Ouvrir http://localhost:3000/ordinateurs.html → les produits doivent s'afficher identiquement.
  Vérifier l'onglet Network : requête vers `/api/products?subcategory=portables` présente.

- [ ] **Step 5 : Commit**

```bash
git add ordinateurs.html
git commit -m "feat: ordinateurs.html lit les produits depuis /api/products"
```

---

### Task 10 : produit.html — lecture depuis l'API

**Files:**
- Modify: `produit.html`

- [ ] **Step 1 : Identifier la lecture actuelle du produit**

  Le script de `produit.html` lit `?id=lenovo-ideapad-3` en query string et cherche dans `PRODUCTS`.

- [ ] **Step 2 : Remplacer par fetch API**

  Trouver le bloc similaire à :
  ```javascript
  const id = new URLSearchParams(window.location.search).get('id');
  const p = PRODUCTS.find(x => x.id === id);
  ```

  Remplacer par :
  ```javascript
  const id = new URLSearchParams(window.location.search).get('id');
  const res = await fetch(`/api/products/${id}`);
  if (!res.ok) { document.body.innerHTML = '<p>Produit introuvable</p>'; return; }
  const p = await res.json();
  // Adapter les noms de champs : p.price_eur au lieu de p.price, p.price_kmf au lieu de p.priceKmf
  ```

- [ ] **Step 3 : Adapter les champs renommés**

  Dans le template de rendu :
  - `p.price` → `p.price_eur`
  - `p.priceKmf` → `p.price_kmf`
  - `p.priceOld` → `p.price_old`
  - `p.badgeClass` → `p.badge_class`
  - `p.ratingCount` → `p.rating_count`
  - `p.stock` (label) → `p.stock_label`

- [ ] **Step 4 : Supprimer `<script src="js/products.js">` de produit.html**

- [ ] **Step 5 : Vérifier dans le navigateur**

  http://localhost:3000/produit.html?id=lenovo-ideapad-3 → produit s'affiche correctement avec images, specs, galerie.

- [ ] **Step 6 : Commit**

```bash
git add produit.html
git commit -m "feat: produit.html lit le produit depuis /api/products/:id"
```

---

### Task 11 : Déploiement Phase 0+1 en production

- [ ] **Step 1 : Vérifier que tout fonctionne en local**

```bash
curl "http://localhost:3000/api/products?limit=5"
curl "http://localhost:3000/api/categories"
```

- [ ] **Step 2 : Déployer en preview d'abord**

```bash
npx vercel
```

  Tester l'URL preview : ordinateurs.html + produit.html fonctionnent.

- [ ] **Step 3 : Déployer en production**

```bash
npx vercel --prod --yes
```

- [ ] **Step 4 : Smoke test production**

```bash
curl "https://alkamar-info.vercel.app/api/products?limit=1"
```

  Attendu : 1 produit JSON.

---

## Phase 2 : Admin Panel

### Task 12 : CSS admin + config + API wrapper

**Files:**
- Create: `admin/css/admin.css`
- Create: `admin/js/config.js`
- Create: `admin/js/api.js`

- [ ] **Step 1 : Créer `admin/js/config.js`**

  Remplacer les valeurs par vos vraies clés publiques Supabase.

```javascript
// admin/js/config.js
window.ADMIN_CONFIG = {
  supabaseUrl: 'https://VOTRE_PROJECT_ID.supabase.co',
  supabaseAnonKey: 'votre_anon_key_publique',
  apiBase: '',  // '' = même domaine (Vercel), ou 'https://alkamar-info.vercel.app' si besoin
};
```

- [ ] **Step 2 : Créer `admin/js/api.js`**

```javascript
// admin/js/api.js
// Wrapper fetch qui ajoute automatiquement le JWT Supabase
const api = {
  async _fetch(path, options = {}) {
    const session = JSON.parse(localStorage.getItem('alkamar_admin_session') || 'null');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

    const res = await fetch(window.ADMIN_CONFIG.apiBase + path, { ...options, headers });
    if (res.status === 401) { window.location.href = '/admin/login.html'; return null; }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Erreur serveur');
    }
    return res.status === 204 ? null : res.json();
  },
  get: (path) => api._fetch(path),
  post: (path, body) => api._fetch(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => api._fetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => api._fetch(path, { method: 'DELETE' }),
};
```

- [ ] **Step 3 : Créer `admin/css/admin.css`**

```css
/* admin/css/admin.css */
:root {
  --admin-bg: #0f172a;
  --admin-surface: #1e293b;
  --admin-border: #334155;
  --admin-accent: #3b82f6;
  --admin-accent-hover: #2563eb;
  --admin-text: #f1f5f9;
  --admin-muted: #94a3b8;
  --admin-danger: #ef4444;
  --admin-success: #22c55e;
  --admin-warning: #f59e0b;
  --admin-sidebar-w: 240px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: var(--admin-bg); color: var(--admin-text); min-height: 100vh; }
a { color: var(--admin-accent); text-decoration: none; }
a:hover { text-decoration: underline; }

/* Layout */
.admin-layout { display: flex; min-height: 100vh; }
.admin-sidebar {
  width: var(--admin-sidebar-w); background: var(--admin-surface);
  border-right: 1px solid var(--admin-border); padding: 24px 0;
  position: fixed; top: 0; left: 0; bottom: 0; overflow-y: auto; z-index: 10;
}
.admin-main { margin-left: var(--admin-sidebar-w); flex: 1; padding: 32px; max-width: 1200px; }
.admin-sidebar__logo { padding: 0 20px 24px; font-weight: 800; font-size: 18px; color: var(--admin-accent); }
.admin-sidebar__logo span { font-weight: 300; color: var(--admin-muted); }
.admin-nav a {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 20px; color: var(--admin-muted); font-size: 14px; font-weight: 500;
  border-left: 3px solid transparent; transition: all .15s;
}
.admin-nav a:hover, .admin-nav a.active {
  color: var(--admin-text); background: rgba(59,130,246,.1);
  border-left-color: var(--admin-accent); text-decoration: none;
}
.admin-nav .section { padding: 16px 20px 4px; font-size: 11px; text-transform: uppercase;
  letter-spacing: .08em; color: var(--admin-muted); }

/* Page header */
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
.page-header h1 { font-size: 24px; font-weight: 700; }

/* Cards stats */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 28px; }
.stat-card { background: var(--admin-surface); border: 1px solid var(--admin-border); border-radius: 10px; padding: 20px; }
.stat-card__label { font-size: 12px; color: var(--admin-muted); text-transform: uppercase; letter-spacing: .05em; }
.stat-card__value { font-size: 28px; font-weight: 700; margin-top: 6px; }
.stat-card__sub { font-size: 12px; color: var(--admin-muted); margin-top: 4px; }

/* Table */
.admin-table-wrap { background: var(--admin-surface); border: 1px solid var(--admin-border); border-radius: 10px; overflow: hidden; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.admin-table th { background: rgba(255,255,255,.04); padding: 12px 16px; text-align: left;
  font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--admin-muted);
  border-bottom: 1px solid var(--admin-border); }
.admin-table td { padding: 12px 16px; border-bottom: 1px solid var(--admin-border); vertical-align: middle; }
.admin-table tr:last-child td { border-bottom: none; }
.admin-table tr:hover td { background: rgba(255,255,255,.02); }

/* Badge statut */
.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.badge--active   { background: rgba(34,197,94,.15); color: var(--admin-success); }
.badge--draft    { background: rgba(148,163,184,.15); color: var(--admin-muted); }
.badge--archived { background: rgba(239,68,68,.1); color: var(--admin-danger); }
.badge--pending  { background: rgba(245,158,11,.15); color: var(--admin-warning); }
.badge--confirmed { background: rgba(59,130,246,.15); color: var(--admin-accent); }
.badge--shipped   { background: rgba(168,85,247,.15); color: #a855f7; }
.badge--delivered { background: rgba(34,197,94,.15); color: var(--admin-success); }
.badge--cancelled { background: rgba(239,68,68,.1); color: var(--admin-danger); }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
  border: none; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .15s; }
.btn--primary { background: var(--admin-accent); color: #fff; }
.btn--primary:hover { background: var(--admin-accent-hover); }
.btn--ghost { background: transparent; color: var(--admin-muted); border: 1px solid var(--admin-border); }
.btn--ghost:hover { background: var(--admin-surface); color: var(--admin-text); }
.btn--danger { background: rgba(239,68,68,.15); color: var(--admin-danger); }
.btn--danger:hover { background: rgba(239,68,68,.25); }
.btn--sm { padding: 5px 10px; font-size: 12px; }

/* Form */
.form-group { margin-bottom: 18px; }
.form-group label { display: block; font-size: 13px; font-weight: 500; color: var(--admin-muted); margin-bottom: 6px; }
.form-control {
  width: 100%; padding: 9px 12px; background: var(--admin-bg);
  border: 1px solid var(--admin-border); border-radius: 7px; color: var(--admin-text);
  font-size: 14px; outline: none; transition: border-color .15s;
}
.form-control:focus { border-color: var(--admin-accent); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-card { background: var(--admin-surface); border: 1px solid var(--admin-border); border-radius: 10px; padding: 24px; margin-bottom: 20px; }
.form-card h2 { font-size: 15px; font-weight: 600; margin-bottom: 18px; color: var(--admin-muted); }

/* Alerts */
.alert { padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 16px; }
.alert--error { background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3); color: var(--admin-danger); }
.alert--success { background: rgba(34,197,94,.1); border: 1px solid rgba(34,197,94,.3); color: var(--admin-success); }

/* Filters bar */
.filters-bar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.filters-bar .form-control { width: auto; flex: 1; min-width: 180px; }

/* Product thumb */
.prod-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; background: #334155; }
```

- [ ] **Step 4 : Commit**

```bash
git add admin/
git commit -m "feat: admin CSS + config + API wrapper"
```

---

### Task 13 : Admin auth (login + guard)

**Files:**
- Create: `admin/js/auth.js`
- Create: `admin/login.html`

- [ ] **Step 1 : Créer `admin/js/auth.js`**

```javascript
// admin/js/auth.js
// Nécessite Supabase JS CDN + admin/js/config.js chargés avant

let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = window.supabase.createClient(
      window.ADMIN_CONFIG.supabaseUrl,
      window.ADMIN_CONFIG.supabaseAnonKey
    );
  }
  return _supabase;
}

async function getSession() {
  const raw = localStorage.getItem('alkamar_admin_session');
  if (!raw) return null;
  const session = JSON.parse(raw);
  // Vérifier expiration
  if (session.expires_at && Date.now() / 1000 > session.expires_at) {
    localStorage.removeItem('alkamar_admin_session');
    return null;
  }
  return session;
}

async function requireAuth() {
  const session = await getSession();
  if (!session) window.location.href = '/admin/login.html';
  return session;
}

async function login(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  localStorage.setItem('alkamar_admin_session', JSON.stringify(data.session));
  return data.session;
}

async function logout() {
  const sb = getSupabase();
  await sb.auth.signOut();
  localStorage.removeItem('alkamar_admin_session');
  window.location.href = '/admin/login.html';
}

window.adminAuth = { requireAuth, login, logout, getSession };
```

- [ ] **Step 2 : Créer `admin/login.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connexion — Alkamar Info Admin</title>
  <link rel="stylesheet" href="/admin/css/admin.css">
  <style>
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .login-box { width: 100%; max-width: 380px; }
    .login-box h1 { font-size: 22px; margin-bottom: 8px; }
    .login-box p { color: var(--admin-muted); font-size: 14px; margin-bottom: 28px; }
    .login-logo { font-size: 24px; font-weight: 800; color: var(--admin-accent); margin-bottom: 32px; }
  </style>
</head>
<body>
  <div class="login-box">
    <div class="login-logo">Alkamar <span style="color:var(--admin-muted);font-weight:300">Admin</span></div>
    <h1>Connexion</h1>
    <p>Accès réservé aux administrateurs.</p>
    <div id="alert" class="alert alert--error" style="display:none"></div>
    <form id="login-form">
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" class="form-control" required autocomplete="email">
      </div>
      <div class="form-group">
        <label for="password">Mot de passe</label>
        <input type="password" id="password" class="form-control" required autocomplete="current-password">
      </div>
      <button type="submit" class="btn btn--primary" style="width:100%">Se connecter</button>
    </form>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/admin/js/config.js"></script>
  <script src="/admin/js/auth.js"></script>
  <script>
    // Si déjà connecté → rediriger
    adminAuth.getSession().then(s => { if (s) window.location.href = '/admin/'; });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      const alert = document.getElementById('alert');
      btn.disabled = true; btn.textContent = 'Connexion...';
      alert.style.display = 'none';
      try {
        await adminAuth.login(
          document.getElementById('email').value,
          document.getElementById('password').value
        );
        window.location.href = '/admin/';
      } catch (err) {
        alert.textContent = err.message; alert.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Se connecter';
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 3 : Créer le premier utilisateur admin dans Supabase**

  Supabase Dashboard → Authentication → Users → Invite user (ou Add user) :
  - Email : votre email
  - Password : mot de passe fort

  Puis dans SQL Editor :
  ```sql
  INSERT INTO user_profiles (id, role, full_name)
  SELECT id, 'admin', 'Admin Alkamar'
  FROM auth.users
  WHERE email = 'votre@email.com';
  ```

- [ ] **Step 4 : Tester la connexion**

  http://localhost:3000/admin/login.html → entrer les identifiants → doit rediriger vers `/admin/`.

- [ ] **Step 5 : Commit**

```bash
git add admin/js/auth.js admin/login.html
git commit -m "feat: admin login page + auth guard"
```

---

### Task 14 : Admin sidebar (layout.js)

**Files:**
- Create: `admin/js/layout.js`

- [ ] **Step 1 : Créer `admin/js/layout.js`**

```javascript
// admin/js/layout.js
// Injecte la sidebar dans .admin-layout et marque le lien actif

function injectSidebar() {
  const page = window.location.pathname;

  const SIDEBAR_HTML = `
  <aside class="admin-sidebar">
    <div class="admin-sidebar__logo">Alkamar <span>Admin</span></div>
    <nav class="admin-nav">
      <div class="section">Vue d'ensemble</div>
      <a href="/admin/" data-path="/admin/index.html,/admin/">📊 Dashboard</a>

      <div class="section">Catalogue</div>
      <a href="/admin/products/" data-path="/admin/products/">📦 Produits</a>
      <a href="/admin/categories/" data-path="/admin/categories/">🗂️ Catégories</a>

      <div class="section">Ventes</div>
      <a href="/admin/orders/" data-path="/admin/orders/">🛒 Commandes</a>
      <a href="/admin/customers/" data-path="/admin/customers/">👥 Clients</a>

      <div class="section">Paramètres</div>
      <a href="/admin/users/" data-path="/admin/users/">🔑 Utilisateurs</a>
      <a href="#" id="logout-btn">🚪 Déconnexion</a>
    </nav>
  </aside>`;

  const layout = document.querySelector('.admin-layout');
  if (layout) layout.insertAdjacentHTML('afterbegin', SIDEBAR_HTML);

  // Marquer lien actif
  document.querySelectorAll('.admin-nav a[data-path]').forEach(a => {
    const paths = a.dataset.path.split(',');
    if (paths.some(p => page.endsWith(p) || page === p.replace('index.html', ''))) {
      a.classList.add('active');
    }
  });

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); adminAuth.logout(); });
}

document.addEventListener('DOMContentLoaded', injectSidebar);
```

- [ ] **Step 2 : Commit**

```bash
git add admin/js/layout.js
git commit -m "feat: admin sidebar layout"
```

---

### Task 15 : Dashboard

**Files:**
- Create: `admin/index.html`
- Create: `admin/js/dashboard.js`

- [ ] **Step 1 : Créer `admin/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dashboard — Alkamar Admin</title>
  <link rel="stylesheet" href="/admin/css/admin.css">
</head>
<body>
  <div class="admin-layout">
    <main class="admin-main">
      <div class="page-header">
        <h1>Dashboard</h1>
        <span id="month-label" style="color:var(--admin-muted);font-size:14px"></span>
      </div>
      <div class="stats-grid" id="stats-grid">
        <div class="stat-card"><div class="stat-card__label">CA du mois (EUR)</div><div class="stat-card__value" id="ca-eur">—</div></div>
        <div class="stat-card"><div class="stat-card__label">CA du mois (KMF)</div><div class="stat-card__value" id="ca-kmf">—</div></div>
        <div class="stat-card"><div class="stat-card__label">Commandes totales</div><div class="stat-card__value" id="orders-total">—</div><div class="stat-card__sub" id="orders-pending"></div></div>
        <div class="stat-card"><div class="stat-card__label">Alertes stock faible</div><div class="stat-card__value" id="stock-alerts">—</div><div class="stat-card__sub">produits &lt; 3 unités</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div>
          <h2 style="margin-bottom:12px;font-size:16px">Dernières commandes</h2>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>Client</th><th>Montant</th><th>Statut</th><th>Date</th></tr></thead>
              <tbody id="recent-orders-body"><tr><td colspan="4" style="text-align:center;color:var(--admin-muted);padding:20px">Chargement...</td></tr></tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 style="margin-bottom:12px;font-size:16px">Stocks faibles</h2>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>Produit</th><th>Stock</th></tr></thead>
              <tbody id="stock-body"><tr><td colspan="2" style="text-align:center;color:var(--admin-muted);padding:20px">Chargement...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/admin/js/config.js"></script>
  <script src="/admin/js/auth.js"></script>
  <script src="/admin/js/api.js"></script>
  <script src="/admin/js/layout.js"></script>
  <script src="/admin/js/dashboard.js"></script>
</body>
</html>
```

- [ ] **Step 2 : Créer `admin/js/dashboard.js`**

```javascript
// admin/js/dashboard.js
const STATUS_LABELS = {
  pending: 'En attente', confirmed: 'Confirmée',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée',
};

async function loadDashboard() {
  await adminAuth.requireAuth();

  // Libellé du mois
  const now = new Date();
  document.getElementById('month-label').textContent =
    now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });

  try {
    const stats = await api.get('/api/stats');

    document.getElementById('ca-eur').textContent =
      stats.ca.eur.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    document.getElementById('ca-kmf').textContent =
      stats.ca.kmf.toLocaleString('fr-FR') + ' KMF';
    document.getElementById('orders-total').textContent = stats.orders.total;
    document.getElementById('orders-pending').textContent =
      `${stats.orders.pending} en attente`;
    document.getElementById('stock-alerts').textContent = stats.stock_alerts.length;

    // Dernières commandes
    const tbody = document.getElementById('recent-orders-body');
    tbody.innerHTML = stats.recent_orders.length === 0
      ? '<tr><td colspan="4" style="text-align:center;color:var(--admin-muted);padding:16px">Aucune commande</td></tr>'
      : stats.recent_orders.map(o => `
          <tr>
            <td><a href="/admin/orders/detail.html?id=${o.id}">${o.customers?.name || '—'}</a></td>
            <td>${Number(o.total_eur).toFixed(2)} €</td>
            <td><span class="badge badge--${o.status}">${STATUS_LABELS[o.status] || o.status}</span></td>
            <td style="color:var(--admin-muted);font-size:12px">${new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
          </tr>`).join('');

    // Stocks faibles
    const stockBody = document.getElementById('stock-body');
    stockBody.innerHTML = stats.stock_alerts.length === 0
      ? '<tr><td colspan="2" style="text-align:center;color:var(--admin-muted);padding:16px">Aucune alerte</td></tr>'
      : stats.stock_alerts.map(p => `
          <tr>
            <td><a href="/admin/products/edit.html?id=${p.id}">${p.name}</a></td>
            <td style="color:${p.stock === 0 ? 'var(--admin-danger)' : 'var(--admin-warning)'};font-weight:700">${p.stock}</td>
          </tr>`).join('');
  } catch (e) {
    console.error('Dashboard error:', e);
  }
}

loadDashboard();
```

- [ ] **Step 3 : Commit**

```bash
git add admin/index.html admin/js/dashboard.js
git commit -m "feat: admin dashboard avec stats et alertes stock"
```

---

### Task 16 : Liste produits admin

**Files:**
- Create: `admin/products/index.html`
- Create: `admin/js/products-list.js`

- [ ] **Step 1 : Créer `admin/products/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Produits — Alkamar Admin</title>
  <link rel="stylesheet" href="/admin/css/admin.css">
</head>
<body>
  <div class="admin-layout">
    <main class="admin-main">
      <div class="page-header">
        <h1>Produits</h1>
        <a href="/admin/products/edit.html" class="btn btn--primary">+ Nouveau produit</a>
      </div>
      <div class="filters-bar">
        <input type="text" id="search" class="form-control" placeholder="Rechercher un produit...">
        <select id="filter-status" class="form-control">
          <option value="all">Tous les statuts</option>
          <option value="active" selected>Actifs</option>
          <option value="draft">Brouillons</option>
          <option value="archived">Archivés</option>
        </select>
        <select id="filter-cat" class="form-control">
          <option value="">Toutes catégories</option>
        </select>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th style="width:50px"></th>
              <th>Nom</th>
              <th>Catégorie</th>
              <th>Prix EUR</th>
              <th>Stock</th>
              <th>Statut</th>
              <th style="width:100px">Actions</th>
            </tr>
          </thead>
          <tbody id="products-body">
            <tr><td colspan="7" style="text-align:center;padding:24px;color:var(--admin-muted)">Chargement...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="pagination" style="margin-top:16px;display:flex;gap:8px;align-items:center"></div>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/admin/js/config.js"></script>
  <script src="/admin/js/auth.js"></script>
  <script src="/admin/js/api.js"></script>
  <script src="/admin/js/layout.js"></script>
  <script src="/admin/js/products-list.js"></script>
</body>
</html>
```

- [ ] **Step 2 : Créer `admin/js/products-list.js`**

```javascript
// admin/js/products-list.js
const PAGE_SIZE = 50;
let currentOffset = 0;
let totalCount = 0;

async function loadCategories() {
  const cats = await api.get('/api/categories');
  const sel = document.getElementById('filter-cat');
  (cats || []).filter(c => !c.parent_id).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

async function loadProducts(offset = 0) {
  const status = document.getElementById('filter-status').value;
  const cat = document.getElementById('filter-cat').value;
  const search = document.getElementById('search').value.trim();

  let url = `/api/products?limit=${PAGE_SIZE}&offset=${offset}&status=${status}`;
  if (cat) url += `&category=${cat}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  const products = await api.get(url);
  const tbody = document.getElementById('products-body');

  if (!products || products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--admin-muted)">Aucun produit trouvé</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td><img src="${p.image || ''}" alt="" class="prod-thumb" onerror="this.style.display='none'"></td>
      <td>
        <a href="/admin/products/edit.html?id=${p.id}" style="font-weight:600;color:var(--admin-text)">${p.name}</a>
        ${p.brand ? `<br><span style="font-size:11px;color:var(--admin-muted)">${p.brand}</span>` : ''}
      </td>
      <td style="font-size:13px;color:var(--admin-muted)">${p.categories?.name || '—'}</td>
      <td>${Number(p.price_eur).toFixed(2)} €</td>
      <td style="color:${p.stock === 0 ? 'var(--admin-danger)' : p.stock < 3 ? 'var(--admin-warning)' : 'inherit'}">${p.stock}</td>
      <td><span class="badge badge--${p.status}">${p.status === 'active' ? 'Actif' : p.status === 'draft' ? 'Brouillon' : 'Archivé'}</span></td>
      <td style="display:flex;gap:6px">
        <a href="/admin/products/edit.html?id=${p.id}" class="btn btn--ghost btn--sm">Éditer</a>
        <button onclick="archiveProduct('${p.id}')" class="btn btn--danger btn--sm">×</button>
      </td>
    </tr>`).join('');
}

async function archiveProduct(id) {
  if (!confirm('Archiver ce produit ?')) return;
  try {
    await api.delete(`/api/products/${id}`);
    loadProducts(currentOffset);
  } catch (e) { alert(e.message); }
}

async function init() {
  await adminAuth.requireAuth();
  await loadCategories();
  await loadProducts();

  let searchTimer;
  document.getElementById('search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { currentOffset = 0; loadProducts(0); }, 300);
  });
  document.getElementById('filter-status').addEventListener('change', () => { currentOffset = 0; loadProducts(0); });
  document.getElementById('filter-cat').addEventListener('change', () => { currentOffset = 0; loadProducts(0); });
}

init();
```

- [ ] **Step 3 : Commit**

```bash
git add admin/products/index.html admin/js/products-list.js
git commit -m "feat: admin liste produits avec filtres"
```

---

### Task 17 : Formulaire édition produit

**Files:**
- Create: `admin/products/edit.html`
- Create: `admin/js/product-edit.js`

- [ ] **Step 1 : Créer `admin/products/edit.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Éditer produit — Alkamar Admin</title>
  <link rel="stylesheet" href="/admin/css/admin.css">
</head>
<body>
  <div class="admin-layout">
    <main class="admin-main">
      <div class="page-header">
        <h1 id="page-title">Nouveau produit</h1>
        <a href="/admin/products/" class="btn btn--ghost">← Retour</a>
      </div>
      <div id="alert" class="alert" style="display:none"></div>
      <form id="product-form">
        <div class="form-card">
          <h2>Informations générales</h2>
          <div class="form-grid">
            <div class="form-group"><label>Nom *</label><input type="text" name="name" class="form-control" required></div>
            <div class="form-group"><label>Marque</label><input type="text" name="brand" class="form-control"></div>
          </div>
          <div class="form-group"><label>Sous-titre</label><input type="text" name="subtitle" class="form-control"></div>
          <div class="form-group"><label>Description</label><textarea name="description" class="form-control" rows="4"></textarea></div>
          <div class="form-group"><label>Catégorie</label><select name="category_id" class="form-control" id="cat-select"><option value="">— Sélectionner —</option></select></div>
        </div>

        <div class="form-card">
          <h2>Prix et stock</h2>
          <div class="form-grid">
            <div class="form-group"><label>Prix EUR *</label><input type="number" name="price_eur" class="form-control" step="0.01" required></div>
            <div class="form-group"><label>Prix KMF *</label><input type="number" name="price_kmf" class="form-control" required></div>
            <div class="form-group"><label>Prix barré EUR</label><input type="number" name="price_old" class="form-control" step="0.01"></div>
            <div class="form-group"><label>Stock</label><input type="number" name="stock" class="form-control" value="0"></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label>Statut</label>
              <select name="status" class="form-control">
                <option value="active">Actif</option>
                <option value="draft">Brouillon</option>
                <option value="archived">Archivé</option>
              </select>
            </div>
            <div class="form-group"><label>Badge</label><input type="text" name="badge" class="form-control" placeholder="ex: Populaire"></div>
          </div>
        </div>

        <div class="form-card">
          <h2>Image principale</h2>
          <div class="form-group"><label>URL image principale</label><input type="url" name="image" class="form-control" placeholder="https://..."></div>
        </div>

        <div class="form-card">
          <h2>Caractéristiques techniques (specs)</h2>
          <div id="specs-container"></div>
          <button type="button" id="add-spec" class="btn btn--ghost btn--sm" style="margin-top:8px">+ Ajouter un spec</button>
        </div>

        <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
          <a href="/admin/products/" class="btn btn--ghost">Annuler</a>
          <button type="submit" class="btn btn--primary" id="submit-btn">Enregistrer</button>
        </div>
      </form>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/admin/js/config.js"></script>
  <script src="/admin/js/auth.js"></script>
  <script src="/admin/js/api.js"></script>
  <script src="/admin/js/layout.js"></script>
  <script src="/admin/js/product-edit.js"></script>
</body>
</html>
```

- [ ] **Step 2 : Créer `admin/js/product-edit.js`**

```javascript
// admin/js/product-edit.js
const productId = new URLSearchParams(window.location.search).get('id');

function addSpecRow(key = '', value = '') {
  const container = document.getElementById('specs-container');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  row.innerHTML = `
    <input type="text" placeholder="Clé (ex: RAM)" value="${key}" class="form-control spec-key" style="flex:1">
    <input type="text" placeholder="Valeur (ex: 16 Go)" value="${value}" class="form-control spec-val" style="flex:2">
    <button type="button" class="btn btn--danger btn--sm" onclick="this.parentElement.remove()">×</button>`;
  container.appendChild(row);
}

function getSpecs() {
  const specs = {};
  document.querySelectorAll('#specs-container > div').forEach(row => {
    const k = row.querySelector('.spec-key').value.trim();
    const v = row.querySelector('.spec-val').value.trim();
    if (k) specs[k] = v;
  });
  return specs;
}

async function loadCategories() {
  const cats = await api.get('/api/categories');
  const sel = document.getElementById('cat-select');
  (cats || []).filter(c => c.parent_id).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

async function loadProduct(id) {
  const p = await api.get(`/api/products/${id}`);
  if (!p) return;
  document.getElementById('page-title').textContent = `Éditer : ${p.name}`;
  const form = document.getElementById('product-form');
  ['name','brand','subtitle','description','price_eur','price_kmf','price_old','stock','status','badge','image'].forEach(f => {
    if (form[f] && p[f] !== null && p[f] !== undefined) form[f].value = p[f];
  });
  if (form.category_id && p.category_id) form.category_id.value = p.category_id;
  // Specs
  Object.entries(p.specs || {}).forEach(([k, v]) => addSpecRow(k, v));
}

async function init() {
  await adminAuth.requireAuth();
  await loadCategories();
  if (productId) await loadProduct(productId);

  // Auto-calculer KMF depuis EUR
  document.querySelector('[name=price_eur]').addEventListener('input', function() {
    const kmfField = document.querySelector('[name=price_kmf]');
    if (this.value) kmfField.value = Math.round(Number(this.value) * 491);
  });

  document.getElementById('add-spec').addEventListener('click', () => addSpecRow());

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const alert = document.getElementById('alert');
    btn.disabled = true; btn.textContent = 'Enregistrement...';
    alert.style.display = 'none';

    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    // Convertir types
    body.price_eur = Number(body.price_eur);
    body.price_kmf = Number(body.price_kmf);
    body.price_old = body.price_old ? Number(body.price_old) : null;
    body.stock = Number(body.stock);
    body.specs = getSpecs();
    if (!body.slug) body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // Supprimer champs vides
    Object.keys(body).forEach(k => { if (body[k] === '' || body[k] === null) delete body[k]; });

    try {
      if (productId) {
        await api.put(`/api/products/${productId}`, body);
      } else {
        await api.post('/api/products', body);
      }
      alert.className = 'alert alert--success'; alert.textContent = 'Produit enregistré !'; alert.style.display = 'block';
      setTimeout(() => window.location.href = '/admin/products/', 800);
    } catch (err) {
      alert.className = 'alert alert--error'; alert.textContent = err.message; alert.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Enregistrer';
    }
  });
}

init();
```

- [ ] **Step 3 : Commit**

```bash
git add admin/products/edit.html admin/js/product-edit.js
git commit -m "feat: admin formulaire ajout/édition produit"
```

---

### Task 18 : Commandes

**Files:**
- Create: `admin/orders/index.html`
- Create: `admin/orders/detail.html`
- Create: `admin/js/orders-list.js`
- Create: `admin/js/order-detail.js`

- [ ] **Step 1 : Créer `admin/orders/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Commandes — Alkamar Admin</title>
  <link rel="stylesheet" href="/admin/css/admin.css">
</head>
<body>
  <div class="admin-layout">
    <main class="admin-main">
      <div class="page-header">
        <h1>Commandes</h1>
        <button id="new-order-btn" class="btn btn--primary">+ Nouvelle commande</button>
      </div>
      <div class="filters-bar">
        <select id="filter-status" class="form-control">
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="confirmed">Confirmée</option>
          <option value="shipped">Expédiée</option>
          <option value="delivered">Livrée</option>
          <option value="cancelled">Annulée</option>
        </select>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>N° commande</th><th>Client</th><th>Total EUR</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody id="orders-body"><tr><td colspan="6" style="text-align:center;padding:24px;color:var(--admin-muted)">Chargement...</td></tr></tbody>
        </table>
      </div>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/admin/js/config.js"></script>
  <script src="/admin/js/auth.js"></script>
  <script src="/admin/js/api.js"></script>
  <script src="/admin/js/layout.js"></script>
  <script src="/admin/js/orders-list.js"></script>
</body>
</html>
```

- [ ] **Step 2 : Créer `admin/js/orders-list.js`**

```javascript
// admin/js/orders-list.js
const STATUS_LABELS = {
  pending: 'En attente', confirmed: 'Confirmée',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée',
};

async function loadOrders() {
  const status = document.getElementById('filter-status').value;
  let url = '/api/orders?limit=50';
  if (status) url += `&status=${status}`;
  const orders = await api.get(url);
  const tbody = document.getElementById('orders-body');
  if (!orders || orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--admin-muted)">Aucune commande</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td style="font-family:monospace;font-size:12px;color:var(--admin-muted)">${o.id.slice(0,8)}…</td>
      <td>${o.customers?.name || '—'}</td>
      <td>${Number(o.total_eur).toFixed(2)} €</td>
      <td><span class="badge badge--${o.status}">${STATUS_LABELS[o.status]}</span></td>
      <td style="font-size:13px;color:var(--admin-muted)">${new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
      <td><a href="/admin/orders/detail.html?id=${o.id}" class="btn btn--ghost btn--sm">Voir</a></td>
    </tr>`).join('');
}

async function init() {
  await adminAuth.requireAuth();
  await loadOrders();
  document.getElementById('filter-status').addEventListener('change', loadOrders);
  document.getElementById('new-order-btn').addEventListener('click', () => {
    window.location.href = '/admin/orders/detail.html';
  });
}

init();
```

- [ ] **Step 3 : Créer `admin/orders/detail.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Commande — Alkamar Admin</title>
  <link rel="stylesheet" href="/admin/css/admin.css">
</head>
<body>
  <div class="admin-layout">
    <main class="admin-main">
      <div class="page-header">
        <h1 id="page-title">Commande</h1>
        <a href="/admin/orders/" class="btn btn--ghost">← Retour</a>
      </div>
      <div id="alert" class="alert" style="display:none"></div>
      <div id="order-content" style="display:grid;grid-template-columns:1fr 320px;gap:20px">
        <div>
          <div class="form-card">
            <h2>Articles commandés</h2>
            <div id="order-items">Chargement...</div>
          </div>
        </div>
        <div>
          <div class="form-card">
            <h2>Statut</h2>
            <div class="form-group">
              <select id="status-select" class="form-control">
                <option value="pending">En attente</option>
                <option value="confirmed">Confirmée</option>
                <option value="shipped">Expédiée</option>
                <option value="delivered">Livrée</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
            <div class="form-group"><label>Note interne</label><textarea id="notes" class="form-control" rows="3"></textarea></div>
            <button id="save-status" class="btn btn--primary" style="width:100%">Mettre à jour</button>
          </div>
          <div class="form-card" id="customer-card"><h2>Client</h2><div id="customer-info">—</div></div>
        </div>
      </div>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/admin/js/config.js"></script>
  <script src="/admin/js/auth.js"></script>
  <script src="/admin/js/api.js"></script>
  <script src="/admin/js/layout.js"></script>
  <script src="/admin/js/order-detail.js"></script>
</body>
</html>
```

- [ ] **Step 4 : Créer `admin/js/order-detail.js`**

```javascript
// admin/js/order-detail.js
const orderId = new URLSearchParams(window.location.search).get('id');

async function loadOrder() {
  const o = await api.get(`/api/orders/${orderId}`);
  if (!o) return;
  document.getElementById('page-title').textContent = `Commande #${o.id.slice(0,8)}`;
  document.getElementById('status-select').value = o.status;
  document.getElementById('notes').value = o.notes || '';

  document.getElementById('customer-info').innerHTML = o.customers ? `
    <p style="font-weight:600">${o.customers.name}</p>
    <p style="color:var(--admin-muted);font-size:13px">${o.customers.email || ''}</p>
    <p style="color:var(--admin-muted);font-size:13px">${o.customers.phone || ''}</p>
    <p style="color:var(--admin-muted);font-size:13px">${o.customers.city || ''}</p>
  ` : '—';

  document.getElementById('order-items').innerHTML = (o.order_items || []).map(item => `
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--admin-border)">
      <div>
        <div style="font-weight:600">${item.product_snapshot?.name || item.products?.name || '—'}</div>
        <div style="font-size:12px;color:var(--admin-muted)">Qté : ${item.quantity}</div>
      </div>
      <div style="text-align:right">
        <div>${(Number(item.unit_price_eur) * item.quantity).toFixed(2)} €</div>
        <div style="font-size:12px;color:var(--admin-muted)">${(Number(item.unit_price_kmf) * item.quantity).toLocaleString('fr-FR')} KMF</div>
      </div>
    </div>`).join('') + `
    <div style="display:flex;justify-content:space-between;padding:12px 0;font-weight:700">
      <span>Total</span>
      <span>${Number(o.total_eur).toFixed(2)} € / ${Number(o.total_kmf).toLocaleString('fr-FR')} KMF</span>
    </div>`;
}

async function init() {
  await adminAuth.requireAuth();
  if (orderId) await loadOrder();

  document.getElementById('save-status').addEventListener('click', async () => {
    const alert = document.getElementById('alert');
    try {
      await api.put(`/api/orders/${orderId}`, {
        status: document.getElementById('status-select').value,
        notes: document.getElementById('notes').value,
      });
      alert.className = 'alert alert--success'; alert.textContent = 'Commande mise à jour !'; alert.style.display = 'block';
      setTimeout(() => alert.style.display = 'none', 2000);
    } catch (e) {
      alert.className = 'alert alert--error'; alert.textContent = e.message; alert.style.display = 'block';
    }
  });
}

init();
```

- [ ] **Step 5 : Commit**

```bash
git add admin/orders/ admin/js/orders-list.js admin/js/order-detail.js
git commit -m "feat: admin gestion commandes"
```

---

### Task 19 : Clients, Catégories, Utilisateurs

**Files:**
- Create: `admin/customers/index.html`
- Create: `admin/js/customers.js`
- Create: `admin/categories/index.html`
- Create: `admin/js/categories.js`
- Create: `admin/users/index.html`
- Create: `admin/js/users.js`

- [ ] **Step 1 : Créer `admin/customers/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Clients — Alkamar Admin</title>
  <link rel="stylesheet" href="/admin/css/admin.css">
</head>
<body>
  <div class="admin-layout">
    <main class="admin-main">
      <div class="page-header"><h1>Clients</h1></div>
      <div class="filters-bar">
        <input type="text" id="search" class="form-control" placeholder="Nom, email, téléphone...">
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Ville</th><th>Inscrit le</th></tr></thead>
          <tbody id="customers-body"><tr><td colspan="5" style="text-align:center;padding:24px;color:var(--admin-muted)">Chargement...</td></tr></tbody>
        </table>
      </div>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/admin/js/config.js"></script>
  <script src="/admin/js/auth.js"></script>
  <script src="/admin/js/api.js"></script>
  <script src="/admin/js/layout.js"></script>
  <script src="/admin/js/customers.js"></script>
</body>
</html>
```

- [ ] **Step 2 : Créer `admin/js/customers.js`**

```javascript
// admin/js/customers.js
async function loadCustomers() {
  const search = document.getElementById('search').value.trim();
  let url = '/api/customers?limit=50';
  if (search) url += `&search=${encodeURIComponent(search)}`;
  const customers = await api.get(url);
  const tbody = document.getElementById('customers-body');
  if (!customers || customers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--admin-muted)">Aucun client</td></tr>';
    return;
  }
  tbody.innerHTML = customers.map(c => `
    <tr>
      <td style="font-weight:600">${c.name}</td>
      <td style="color:var(--admin-muted)">${c.email || '—'}</td>
      <td style="color:var(--admin-muted)">${c.phone || '—'}</td>
      <td style="color:var(--admin-muted)">${c.city || '—'}</td>
      <td style="font-size:12px;color:var(--admin-muted)">${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
    </tr>`).join('');
}

async function init() {
  await adminAuth.requireAuth();
  await loadCustomers();
  let t;
  document.getElementById('search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadCustomers, 300); });
}

init();
```

- [ ] **Step 3 : Créer `admin/categories/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Catégories — Alkamar Admin</title>
  <link rel="stylesheet" href="/admin/css/admin.css">
</head>
<body>
  <div class="admin-layout">
    <main class="admin-main">
      <div class="page-header"><h1>Catégories</h1></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Icône</th><th>Nom</th><th>Slug</th><th>Parent</th><th>Ordre</th></tr></thead>
          <tbody id="cats-body"><tr><td colspan="5" style="text-align:center;padding:24px;color:var(--admin-muted)">Chargement...</td></tr></tbody>
        </table>
      </div>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/admin/js/config.js"></script>
  <script src="/admin/js/auth.js"></script>
  <script src="/admin/js/api.js"></script>
  <script src="/admin/js/layout.js"></script>
  <script src="/admin/js/categories.js"></script>
</body>
</html>
```

- [ ] **Step 4 : Créer `admin/js/categories.js`**

```javascript
// admin/js/categories.js
async function init() {
  await adminAuth.requireAuth();
  const cats = await api.get('/api/categories');
  const parentMap = Object.fromEntries((cats || []).map(c => [c.id, c.name]));
  const tbody = document.getElementById('cats-body');
  tbody.innerHTML = (cats || []).map(c => `
    <tr>
      <td>${c.icon || ''}</td>
      <td style="font-weight:${c.parent_id ? '400' : '700'}">${c.parent_id ? '↳ ' : ''}${c.name}</td>
      <td style="font-family:monospace;font-size:12px;color:var(--admin-muted)">${c.slug}</td>
      <td style="color:var(--admin-muted)">${c.parent_id ? parentMap[c.parent_id] || '—' : '—'}</td>
      <td style="color:var(--admin-muted)">${c.sort_order}</td>
    </tr>`).join('');
}

init();
```

- [ ] **Step 5 : Créer `admin/users/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Utilisateurs — Alkamar Admin</title>
  <link rel="stylesheet" href="/admin/css/admin.css">
</head>
<body>
  <div class="admin-layout">
    <main class="admin-main">
      <div class="page-header"><h1>Utilisateurs admin</h1></div>
      <div class="form-card" style="max-width:480px">
        <h2>Créer un utilisateur</h2>
        <p style="color:var(--admin-muted);font-size:13px;margin-bottom:16px">
          Créer d'abord l'utilisateur dans le dashboard Supabase (Authentication → Users), puis assigner son rôle ici.
        </p>
        <div id="alert" class="alert" style="display:none"></div>
        <div class="form-group"><label>UUID utilisateur Supabase</label><input type="text" id="user-id" class="form-control" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"></div>
        <div class="form-group"><label>Nom complet</label><input type="text" id="full-name" class="form-control"></div>
        <div class="form-group"><label>Rôle</label>
          <select id="role" class="form-control">
            <option value="editor">Editor (produits)</option>
            <option value="commercial">Commercial (commandes + clients)</option>
            <option value="admin">Admin (tout)</option>
          </select>
        </div>
        <button id="create-user" class="btn btn--primary">Créer le profil</button>
      </div>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/admin/js/config.js"></script>
  <script src="/admin/js/auth.js"></script>
  <script src="/admin/js/api.js"></script>
  <script src="/admin/js/layout.js"></script>
  <script src="/admin/js/users.js"></script>
</body>
</html>
```

- [ ] **Step 6 : Créer `admin/js/users.js`**

```javascript
// admin/js/users.js
// La création de profils passe par Supabase directement (service_role requis)
// → on utilise le client Supabase anon + l'utilisateur doit être admin pour upsert user_profiles

async function init() {
  await adminAuth.requireAuth();

  document.getElementById('create-user').addEventListener('click', async () => {
    const alert = document.getElementById('alert');
    const id = document.getElementById('user-id').value.trim();
    const full_name = document.getElementById('full-name').value.trim();
    const role = document.getElementById('role').value;

    if (!id) { alert.className = 'alert alert--error'; alert.textContent = 'UUID requis'; alert.style.display = 'block'; return; }

    // INSERT via API (nécessite endpoint dédié ou SQL direct dans Supabase)
    // Pour simplifier, afficher la commande SQL à exécuter
    alert.className = 'alert alert--success';
    alert.innerHTML = `Exécuter dans Supabase SQL Editor :<br>
      <code style="font-family:monospace;font-size:12px;word-break:break-all">
      INSERT INTO user_profiles (id, role, full_name) VALUES ('${id}', '${role}', '${full_name}')
      ON CONFLICT (id) DO UPDATE SET role='${role}', full_name='${full_name}';
      </code>`;
    alert.style.display = 'block';
  });
}

init();
```

- [ ] **Step 7 : Commit**

```bash
git add admin/customers/ admin/categories/ admin/users/ admin/js/customers.js admin/js/categories.js admin/js/users.js
git commit -m "feat: admin clients, catégories, utilisateurs"
```

---

## Phase 3 : Stabilisation

### Task 20 : Déploiement final + validation

- [ ] **Step 1 : Test bout en bout local**

  1. `npx vercel dev`
  2. Aller sur http://localhost:3000/admin/login.html → se connecter
  3. Dashboard → stats s'affichent (valeurs à 0 si pas de commandes — normal)
  4. Produits → liste de 226 produits
  5. Cliquer "Éditer" sur un produit → formulaire pré-rempli
  6. Modifier le stock → enregistrer → revenir à la liste → stock mis à jour
  7. http://localhost:3000/ordinateurs.html → produits s'affichent depuis l'API
  8. http://localhost:3000/produit.html?id=lenovo-ideapad-3 → page produit s'affiche

- [ ] **Step 2 : Vérifier les policies RLS dans Supabase**

  Supabase Dashboard → Authentication → Policies :
  - `products` → policy `products_public_read` : `status = 'active'`
  - `categories` → policy `categories_public_read` : `true`
  - `customers` → pas de policy SELECT publique (OK — lecture via service_role côté API)
  - `orders` → pas de policy SELECT publique (OK)

- [ ] **Step 3 : Deploy preview**

```bash
npx vercel
```

  Tester l'URL preview complètement.

- [ ] **Step 4 : Deploy production**

```bash
npx vercel --prod --yes
```

- [ ] **Step 5 : Smoke test production**

```bash
curl "https://alkamar-info.vercel.app/api/products?limit=1"
curl "https://alkamar-info.vercel.app/api/categories"
```

  Attendu : réponses JSON valides.

- [ ] **Step 6 : Commit final**

```bash
git add .
git commit -m "feat: Phase 3 — backend+admin complet, site connecté à Supabase"
```

---

## Récapitulatif des tâches

| Phase | Tâches | Livrables |
|-------|--------|-----------|
| 0 — Fondations | 1-8 | API complète + 226 produits en DB |
| 1 — Frontend | 9-11 | Site public lit depuis l'API |
| 2 — Admin | 12-19 | Back-office complet |
| 3 — Stabilisation | 20 | Production validée |
