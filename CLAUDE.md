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

---

## PERFORMANCE — Score 100% Google PageSpeed / Lighthouse

**Contrainte prioritaire absolue.** Le site a atteint 100% sur mobile et desktop.
Toute modification doit préserver ce score. En cas de doute, ne pas modifier avant d'avoir trouvé une solution compatible.

### Métriques à ne jamais dégrader

| Métrique | Description |
|----------|-------------|
| LCP | Largest Contentful Paint — image ou texte principal |
| CLS | Cumulative Layout Shift — stabilité visuelle |
| TBT | Total Blocking Time — blocage du thread principal |
| FCP | First Contentful Paint — premier rendu |
| Taille réseau | Payload total au premier chargement |
| Accessibilité | Attributs alt, contraste, structure |
| SEO | Balises meta, canonical, structure headings |
| Best Practices | HTTPS, CSP, sécurité, pas de libs obsolètes |

---

### Règles images

- Utiliser **WebP** ou **AVIF** pour toutes les nouvelles images.
- Toujours utiliser `<picture>` avec sources AVIF + WebP + fallback.
- Toujours définir `width` et `height` sur chaque `<img>`.
- `loading="lazy"` sur toutes les images non visibles au premier écran.
- `fetchpriority="high"` **uniquement** sur l'image LCP réelle (une seule par page).
- `decoding="async"` sur toutes les images sans exception — jamais `decoding="sync"`.
- Ne jamais committer une image de plus de 200 KB sans compression préalable.
- Vérifier le poids avant commit : `Get-Item images/... | Select Length`.
- L'image LCP actuelle (`/images/equipe-alkamar.png`) a des versions optimisées :
  - `equipe-alkamar-320.avif` (13.7 KB), `equipe-alkamar-480.avif` (22.7 KB)
  - `equipe-alkamar-320.webp` (22.6 KB), `equipe-alkamar-480.webp` (43.2 KB)
  - Ne pas remplacer par une image plus lourde.

---

### Règles API

- Ne jamais faire **deux fetches identiques** au même endpoint sur la même page.
  - Le cache partagé `window._productsCache` est en place — l'utiliser.
- Ne jamais déclencher un fetch lourd **au parse time** (pendant le chargement HTML).
  - Déclencher après `load` event via `_startProductsCache()`.
- Ne jamais charger `limit=500` si la page affiche moins de produits.
- Ne jamais exposer de données admin ou fournisseur côté public.
- Ajouter `Cache-Control` approprié sur toutes les routes API publiques stables.

---

### Règles CSS / JS

- Ne jamais ajouter un `<link rel="stylesheet">` bloquant supplémentaire en `<head>`.
- Ne jamais ajouter `<link rel="preload" as="style">` sans le trick `onload` — c'est inutile.
- Ne jamais ajouter `<link rel="preload" as="image">` sur un format différent de celui chargé par `<picture>` (cause double fetch).
- Ne jamais ajouter de script tiers sans nécessité absolue.
- Tout script non critique doit avoir `defer` ou `async`.
- Éviter les traitements coûteux (tri, filter, parsing) au chargement initial.
- Reporter les scripts au `load` event s'ils ne sont pas nécessaires au LCP.

---

### Règles design

- **Ne jamais modifier** le design, les couleurs, les spacings, les cards ou le responsive sans demande explicite.
- Toute optimisation de performance doit produire un rendu visuellement identique.
- Si un changement visuel est strictement nécessaire pour corriger une performance, le documenter dans le commit.

---

### Règles embed boutique (info-experts.fr ↔ boutique.info-experts.fr)

- L'iframe dans `info-experts.fr/boutique.html` doit toujours avoir :
  - `src="https://boutique.info-experts.fr"` (pas `alkamar-info.vercel.app`)
  - `loading="eager"` (contenu principal)
  - `allow="payment"`
  - Pas de `sandbox` (casserait localStorage / cookies)
- Le postMessage Stripe utilise `window.top.location.href = url` directement depuis l'iframe (pas via le handler `message` du parent — bloqué sur iOS Safari).
- `frame-ancestors` dans le CSP de la boutique autorise uniquement `info-experts.fr` et `www.info-experts.fr`.
- Ne jamais supprimer `allow="payment"` de l'iframe.
- Ne jamais ajouter `sandbox` sans vérifier l'impact sur Stripe et le panier.

---

### Ce qui ne doit jamais être cassé

- Stripe (checkout, session, redirect, postMessage)
- Panier (localStorage, ajout, suppression, total)
- Checkout (validation, modes de paiement, livraison)
- Admin (routes protégées, auth Supabase)
- SEO (balises meta, canonical, sitemap, robots)
- Responsive (mobile, tablette, desktop)
- Cache assets (ne pas changer les noms de fichiers immutables sans invalider le cache)

---

## Checklist avant toute modification

Avant de toucher un fichier, vérifier :

- [ ] Quel est l'impact sur LCP, CLS, TBT, FCP ?
- [ ] Est-ce que ça ajoute du poids réseau au premier chargement ?
- [ ] Est-ce que ça ajoute une dépendance ou un script tiers ?
- [ ] Est-ce que ça ajoute une image non optimisée ?
- [ ] Est-ce que ça casse le cache d'un asset existant ?
- [ ] Est-ce qu'une solution plus légère existe ?
- [ ] Est-ce que Stripe et le panier restent fonctionnels ?

Si une réponse est "oui" et non justifiée → chercher une alternative avant d'appliquer.

---

## Checklist après toute modification

Après chaque modification, vérifier :

- [ ] Build réussi (`npm run build` si applicable)
- [ ] Lint propre (`npm run lint` si applicable)
- [ ] Playwright sans erreur critique (`npx playwright test` si dispo)
- [ ] Pas d'erreur console critique dans le browser
- [ ] Produits s'affichent correctement
- [ ] Panier fonctionne (ajout, total, checkout)
- [ ] Stripe fonctionne dans l'embed et hors embed
- [ ] Images optimisées (pas de PNG lourd, lazy loading en place)
- [ ] Pas d'appel API doublon
- [ ] Responsive mobile intact
- [ ] PageSpeed / Lighthouse score préservé (si déploiement)

---

## Commandes de test

```powershell
# Vérifier syntaxe JS
node --check js/search.js
node --check js/catalog.js
node --check js/checkout.js

# Valider JSON
Get-Content vercel.json -Raw | ConvertFrom-Json | Out-Null

# Playwright (si installé)
cd C:\Users\defis\alkamar-info
npx playwright test

# Lighthouse CLI (si installé globalement)
lighthouse https://boutique.info-experts.fr --preset=perf --emulated-form-factor=mobile --output json

# Vérifier poids des images
Get-ChildItem images -Recurse -File | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}} | Sort-Object KB -Descending
```

---

## Que faire si une demande risque de dégrader le score 100%

1. **Ne pas appliquer directement** la solution lourde.
2. Chercher une alternative plus légère (lazy load, cache, compression, découpage).
3. Optimiser l'asset avant de l'intégrer (WebP/AVIF pour images, minification pour JS/CSS).
4. Utiliser le chargement progressif si le contenu n'est pas critique au premier rendu.
5. Signaler dans la réponse que la demande présente un risque et proposer un compromis.
6. **Ne jamais sacrifier le score 100% sans validation explicite de l'utilisateur.**

---

## Rapport final obligatoire

À chaque intervention, fournir :

```
## Rapport
- Fichiers modifiés : [liste]
- Impact performance estimé : [LCP/CLS/TBT/FCP/réseau]
- Tests lancés : [build / lint / Playwright / Lighthouse]
- Résultat build : [OK / ERREUR]
- Résultat Playwright : [OK / ERREUR / non disponible]
- Vérifications images : [OK / problème détecté]
- Vérifications API : [pas de doublon / problème détecté]
- Score 100% préservé : [OUI / compromis nécessaire — détails]
```

---

## Workflow Performance Automatique

### Description

Système de surveillance et d'optimisation automatique des performances.
Il couvre l'audit statique du code, les vérifications PageSpeed Insights,
les rapports Lighthouse CI et les corrections sûres automatisées.

### Fichiers du système

| Fichier | Rôle |
|---------|------|
| `.github/workflows/performance-guard.yml` | CI GitHub Actions (Lighthouse CI + PageSpeed) |
| `lighthouserc.json` | Config Lighthouse CI (URLs, seuils, stratégie) |
| `performance-budget.json` | Budget ressources et timings |
| `scripts/check-pagespeed.mjs` | Appel API PageSpeed Insights (mobile + desktop) |
| `scripts/performance-audit.mjs` | Audit statique : images, HTML, CSS, vercel.json |
| `scripts/auto-optimize-performance.mjs` | Boucle d'optimisation automatique (max 3 passes) |
| `reports/` | Rapports générés (ignorés par git, sauf `.gitkeep`) |

### Commandes disponibles

```powershell
# Audit statique complet (images, HTML, CSS, cache)
npm run performance:audit

# Vérification PageSpeed Insights (nécessite PAGESPEED_API_KEY)
npm run performance:check

# Auto-optimisation contrôlée (max 3 passes)
npm run performance:auto

# Lancer Lighthouse CI (nécessite lhci installé)
npm run lighthouse
```

### Seuils de score

| Métrique | Seuil erreur | Seuil warning |
|----------|--------------|---------------|
| Performance | < 90 (erreur CI) | — |
| Accessibilité | — | < 90 |
| Best Practices | — | < 90 |
| SEO | — | < 90 |
| LCP | > 2500 ms | — |
| CLS | > 0.1 (erreur CI) | — |
| TBT | > 300 ms | — |
| FCP | > 2000 ms | — |
| PageSpeed exit 1 | score < 80 | — |
| PageSpeed warning | score 80-89 | — |

### Corrections autorisées par auto-optimize

- `decoding="sync"` → `decoding="async"` dans les HTML
- `transition:all` → `transition:background-color .15s,color .15s,border-color .15s` dans style.css
- Recompression images > 200 KB avec sharp (PNG q=80, JPEG q=80 mozjpeg)
- Création variantes WebP (q=80) et AVIF (q=65) pour images > 100 KB

### Corrections INTERDITES par auto-optimize

- Design, couleurs, textes visibles
- Prix, produits, données boutique
- Checkout, Stripe, panier
- Admin, routes protégées

### Lancer manuellement (sans CI)

```powershell
# Audit + rapport
cd C:\Users\defis\alkamar-info
npm run performance:audit

# Voir le rapport généré
cat reports/performance-audit.md

# Auto-corriger les problèmes détectés
npm run performance:auto

# Vérifier le rapport d'optimisation
cat reports/auto-optimize-report.md
```

### CI GitHub Actions

Le workflow `.github/workflows/performance-guard.yml` se déclenche :
- À chaque push sur `main`
- À chaque pull request vers `main`
- Automatiquement chaque lundi à 03:00 UTC
- Manuellement via `workflow_dispatch`

Secrets requis dans GitHub :
- `LHCI_GITHUB_APP_TOKEN` — pour afficher les résultats dans les PRs
- `PAGESPEED_API_KEY` — optionnel, pour les vérifications PageSpeed
