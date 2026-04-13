# Alkamar Info — Directives projet pour Claude

## Présentation du projet

Boutique informatique en ligne (Comores) vendant ordinateurs, composants, périphériques, réseau, stockage et matériel reconditionné.

- **URL de production** : déployé sur Vercel
- **Langue** : français (code, commentaires, commits)
- **Contact boutique** : +269 331 27 22

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | HTML statique + CSS vanilla + JavaScript ES Modules |
| Backend | Vercel Serverless Functions (`/api/*.js`) — Node.js ES Modules |
| Base de données | Supabase — PostgreSQL + Auth + Storage (images) |
| Déploiement | Vercel (config dans `.vercel/project.json`) |

---

## Structure des fichiers

```
alkamar-info/
├── index.html              # Page d'accueil
├── composants.html         # Composants PC
├── ecrans.html             # Écrans / moniteurs
├── peripheriques.html      # Périphériques
├── protection.html         # Protection & alimentation
├── promotions.html         # Promotions
├── reconditionnes.html     # Matériel reconditionné
├── reseau.html             # Réseau
├── services.html           # Services
├── stockage.html           # Stockage
├── style.css               # Feuille de style globale
├── js/
│   ├── nav.js              # Navigation / menu mobile
│   └── products.js         # Chargement et affichage des produits
├── images/
│   └── produits/           # Images produits (par catégorie)
├── api/                    # Vercel Serverless Functions
├── admin/                  # Panel d'administration (SPA vanilla JS)
└── docs/
    └── superpowers/
        ├── specs/          # Spécifications de design
        └── plans/          # Plans d'implémentation
```

---

## Conventions de code

### HTML
- `lang="fr"` sur toutes les pages
- Classes BEM : `.block__element--modifier`
- Commentaires de section : `<!-- ── NOM ───────── -->`
- Toujours inclure `style.css` et les scripts JS nécessaires

### CSS (`style.css`)
- Variables CSS dans `:root` pour les couleurs et espacements
- Mobile-first avec media queries
- Pas de framework CSS — vanilla uniquement

### JavaScript
- ES Modules natifs (`type="module"`)
- `async/await` pour les appels API
- Appels API via les fonctions utilitaires `api.get` / `api.post` (qui gèrent le token auth)
- Pas de framework JS — vanilla uniquement

### API (`/api/*.js`)
- Node.js ES Modules (`export default`)
- Authentification via token Supabase dans le header `Authorization: Bearer <token>`
- Toujours valider les entrées et retourner des réponses JSON structurées
- Méthodes HTTP sémantiques : GET (lecture), POST (création), PUT (mise à jour), DELETE (suppression)

---

## Conventions Git

- **Format des commits** : `type(scope): description en français`
- **Types** : `feat`, `fix`, `refactor`, `style`, `docs`, `chore`
- **Exemples** :
  - `feat(admin): ajout de la page commandes`
  - `fix(api): correction validation stock négatif`
  - `style(css): alignement cards produits mobile`

---

## Règles importantes

- Ne jamais exposer les clés Supabase côté client — utiliser uniquement la clé `anon` publique
- Les routes `/admin/*` sont protégées par authentification Supabase Auth
- Les images produits suivent la convention de nommage : `alkamar-info-{catégorie}-{modèle}-{vue}.jpg`
- Pas de dépendances npm côté frontend — le projet public est 100 % vanilla
- Les specs et plans sont dans `docs/superpowers/` — les consulter avant de démarrer une nouvelle fonctionnalité majeure

---

## Sous-projets en cours

Voir `docs/superpowers/specs/2026-04-12-backend-admin-design.md` pour l'architecture complète.

1. **Backend & Admin** *(en cours)* — API Vercel + panel d'administration
2. Frontend public — pages produits dynamiques
3. Espace client — compte, commandes, suivi
4. Intégration paiement — Mobile Money, carte
