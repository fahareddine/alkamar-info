# Spec : Backend + Admin Panel — Alkamar Info

**Date :** 2026-04-12  
**Sous-projet :** Backend & Admin (priorité 1/4)  
**Stack cible :** Vercel Serverless Functions + Supabase (PostgreSQL + Auth + Storage)

---

## 1. Architecture générale

```
┌─────────────────────────────────────────────────────┐
│                    VERCEL                           │
│                                                     │
│  ┌─────────────────┐    ┌────────────────────────┐  │
│  │  Site public    │    │   Admin Panel          │  │
│  │  (HTML statique │    │   /admin/*.html        │  │
│  │   → JS fetch)  │    │   (SPA vanilla JS)     │  │
│  └────────┬────────┘    └──────────┬─────────────┘  │
│           │                        │                 │
│           └──────────┬─────────────┘                 │
│                      ▼                               │
│           ┌─────────────────────┐                    │
│           │  /api/* (Vercel     │                    │
│           │  Serverless Fns)    │                    │
│           │  Node.js ES Modules │                    │
│           └──────────┬──────────┘                    │
└──────────────────────┼──────────────────────────────┘
                       ▼
           ┌───────────────────────┐
           │      SUPABASE         │
           │  PostgreSQL + Auth    │
           │  Storage (images)     │
           └───────────────────────┘
```

### Endpoints API

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/api/products` | Public | Catalogue complet (filtres: category, status, search) |
| GET | `/api/products/:id` | Public | Détail produit |
| POST | `/api/products` | editor, admin | Créer produit |
| PUT | `/api/products/:id` | editor, admin | Modifier produit |
| DELETE | `/api/products/:id` | admin | Archiver produit |
| GET | `/api/orders` | commercial, admin | Liste commandes |
| POST | `/api/orders` | commercial, admin | Créer commande |
| PUT | `/api/orders/:id` | commercial, admin | Modifier statut commande |
| GET | `/api/customers` | commercial, admin | Liste clients |
| GET | `/api/stats` | admin | Stats dashboard |
| GET | `/api/categories` | Public | Arbre catégories |
| POST/PUT/DELETE | `/api/categories` | admin | Gestion catégories |

### Authentification

- Supabase Auth (JWT) pour tous les utilisateurs admin
- Chaque serverless function vérifie le JWT côté serveur avant toute opération d'écriture ou accès sensible
- Header : `Authorization: Bearer <supabase_jwt>`
- Rôles stockés dans `user_profiles.role` : `admin` | `editor` | `commercial`

---

## 2. Schéma base de données

```sql
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
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT,
  price_eur   NUMERIC(10,2) NOT NULL,
  price_kmf   NUMERIC(12,0) NOT NULL,
  stock       INT DEFAULT 0,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  category_id UUID REFERENCES categories(id),
  brand       TEXT,
  model       TEXT,
  image       TEXT,
  gallery     JSONB DEFAULT '[]',   -- [{src, alt}, ...]
  specs       JSONB DEFAULT '{}',   -- {ram: "16Go", cpu: "i5", ...}
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
  product_snapshot JSONB NOT NULL   -- nom + prix figés à la commande
);

-- Profils utilisateurs admin
CREATE TABLE user_profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT DEFAULT 'editor' CHECK (role IN ('admin','editor','commercial')),
  full_name TEXT
);
```

### Notes schéma

- `gallery` et `specs` en JSONB : flexibles, pas de migration pour ajouter un champ specs produit
- `product_snapshot` dans `order_items` : prix et nom figés au moment de la commande
- `categories` auto-référente : gère la hiérarchie catégorie/sous-catégorie existante
- RLS Supabase : les policies limitent les lectures/écritures selon le rôle JWT

---

## 3. Structure Admin Panel

```
/admin/
├── index.html          → Dashboard (stats, alertes stock)
├── login.html          → Authentification Supabase
├── products/
│   ├── index.html      → Liste produits (filtres, recherche, tri, pagination)
│   └── edit.html       → Formulaire ajout/édition produit
├── orders/
│   ├── index.html      → Liste commandes (statut, date, client)
│   └── detail.html     → Détail commande + changement statut
├── customers/
│   └── index.html      → Liste clients + historique achats
├── categories/
│   └── index.html      → Gestion catégories/sous-catégories
└── users/
    └── index.html      → Gestion utilisateurs admin (admin uniquement)
```

### Dashboard — widgets

- CA du mois (EUR + KMF)
- Nombre de commandes (total / en attente)
- Top 5 produits vus
- Alertes stock faible (< 3 unités)
- Dernières commandes (tableau 10 lignes)

### Liste produits

- Tableau paginé (50/page)
- Colonnes : image miniature, nom, catégorie, prix EUR, stock, statut
- Filtres : catégorie, statut, recherche texte
- Actions inline : dupliquer, archiver, éditer

### Formulaire produit

- Champs : nom, slug (auto-généré depuis le nom), description
- Prix EUR + KMF (calcul automatique avec taux configurable)
- Upload images vers Supabase Storage (drag & drop, réordonnement galerie)
- Specs dynamiques : paires clé/valeur ajoutables
- Sélecteur catégorie (arbre hiérarchique)
- Statut : brouillon / actif / archivé

### Commandes

- Pipeline visuel : Reçue → Confirmée → Expédiée → Livrée
- Bouton changement statut + champ note interne
- Récap articles avec snapshot prix

### Tech admin

- Vanilla JS (cohérent avec le projet actuel)
- CSS partagé avec le site public + variables CSS spécifiques admin
- `fetch()` vers `/api/*` avec header `Authorization: Bearer <jwt>`
- Redirection vers `/admin/login.html` si JWT absent ou expiré

---

## 4. Plan de migration

### Phase 0 — Fondations (site public inchangé)

1. Créer projet Supabase (PostgreSQL + Auth + Storage)
2. Appliquer le schéma SQL + RLS policies
3. Créer les serverless functions Vercel (`/api/products`, `/api/categories`)
4. Script de migration one-shot : lire `js/products.js` → insérer en Supabase
5. **Le site public continue à lire `products.js` — rien de cassé**

### Phase 1 — Basculement frontend

6. Modifier les pages HTML (ordinateurs.html, produit.html, etc.) pour `fetch('/api/products')` au lieu de lire products.js
7. Tester chaque page : catalogue, filtres par tab, détail produit
8. Valider en preview Vercel avant de pousser en production
9. Une fois validé : `products.js` devient archive (non supprimé immédiatement)

### Phase 2 — Admin panel

10. `/admin/login.html` + intégration Supabase Auth
11. Dashboard stats (`/api/stats`)
12. CRUD produits + upload images Supabase Storage
13. Gestion commandes (création manuelle en v1, pas encore de panier)
14. Gestion clients
15. Gestion utilisateurs + rôles

### Phase 3 — Stabilisation

16. Tests bout en bout : créer produit admin → visible sur site public
17. Audit RLS policies Supabase
18. Monitoring erreurs via Vercel Logs
19. Documentation interne (endpoints API + guide admin)

### Règle de migration

Chaque phase est déployable et rollbackable indépendamment :
- Phase 0 : aucun changement visible
- Phase 1 : rollback = remettre la lecture de `products.js`
- Phase 2 : additive, n'affecte pas le site public

---

## Hors scope (sous-projets suivants)

- Panier et checkout client (sous-projet 2)
- Comptes clients avec espace personnel (sous-projet 3)
- Migration vers Next.js (sous-projet 4)
- Paiement en ligne automatique (Stripe, etc.)
- Notifications email automatiques
