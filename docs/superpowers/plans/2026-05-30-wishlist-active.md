# Wishlist Active — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le bouton favori pleinement fonctionnel comme Amazon/Cdiscount — animation pop, toast notification, compteur header, page favoris.html dédiée.

**Architecture:** Module IIFE `js/wishlist.js` exposant `window.Wishlist`. Stockage localStorage en tableaux d'objets produit compacts (pas juste des IDs — permet d'afficher favoris.html sans appel API). `catalog.js` appelle `Wishlist.toggle()`, wishlist.js injecte le badge compteur dans le header dynamiquement, favoris.html lit localStorage directement.

**Tech Stack:** Vanilla JS (IIFE), localStorage, CSS animations, HTML statique, 0 dépendance externe

---

## File Map

| Fichier | Action | Rôle |
|---------|--------|------|
| `js/wishlist.js` | CREATE | Module central : toggle, getList, getCount, has, toast, badge nav, migration |
| `style.css` | MODIFY | Ajouter : @keyframes wish-pop, .card-wishlist.wished, .wish-toast, .wish-badge |
| `js/catalog.js` | MODIFY | Remplacer window.toggleWish par appel Wishlist.toggle() avec données DOM |
| `index.html` | MODIFY | Supprimer inline toggleWish (~lignes 1081-1090 et ~1152-1160), ajouter script wishlist.js |
| `favoris.html` | CREATE | Page dédiée, lit localStorage, affiche cartes produits, bouton retirer, vider tout |
| 12 HTML catalog | MODIFY | Ajouter script wishlist.js dans head (après nav.js) |

HTML catalog : composants.html, digital.html, ecrans.html, imprimantes.html, ordinateurs.html, peripheriques.html, promotions.html, protection.html, reconditionnes.html, reseau.html, services.html, stockage.html

---

## Task 1 : Créer `js/wishlist.js`

**Files:** Create `js/wishlist.js`

IIFE exposant `window.Wishlist`. Format localStorage `alkamar_wish` : tableau d'objets `{id, name, brand, price_eur, price_kmf, img, stock, stockClass}`.

- [ ] **Step 1: Créer `js/wishlist.js` avec les fonctions suivantes**

  - `_read()` : parse localStorage, migre les anciens formats string[] vers objet[]
  - `_write(list)` : sérialise vers localStorage
  - `getList()` : retourne le tableau complet
  - `getCount()` : retourne le nombre d'items
  - `has(id)` : retourne bool
  - `toggle(id, productData)` : ajoute ou retire, appelle _emit() et _showToast(), retourne `{added: bool}`
  - `_showToast(msg)` : injecte/réutilise `#wish-toast`, ajoute classe `wish-toast--visible` pendant 2.2s
  - `on(cb)` : enregistre un listener appelé avec getCount() à chaque toggle
  - `_emit()` : appelle tous les listeners
  - `_initNavBadge()` : trouve le `<a class="header__action">` contenant `<span>Favoris</span>`, change son href en `favoris.html`, injecte `<span class="wish-badge" id="wish-badge">`, appelle _updateNavBadge()
  - `_updateNavBadge()` : met à jour le texte et display du badge
  - Enregistre `_updateNavBadge` comme listener via `on()`
  - Appelle `_initNavBadge()` au DOMContentLoaded ou immédiatement si DOM prêt
  - Expose `window.Wishlist = { toggle, getList, getCount, has, on }`

- [ ] **Step 2: Vérifier syntaxe**

  ```powershell
  node --check js/wishlist.js
  ```
  Attendu : aucune sortie (syntaxe OK)

---

## Task 2 : Ajouter les styles CSS dans `style.css`

**Files:** Modify `style.css`

style.css est minifié sur une seule ligne. Appendre ces règles à la fin (Edit tool, chercher la dernière accolade fermante du fichier).

- [ ] **Step 1: Appendre à la fin de style.css**

  Règles à ajouter (une seule ligne, pas de saut) :

  ```
  @keyframes wish-pop{0%{transform:scale(1)}40%{transform:scale(1.45)}70%{transform:scale(.88)}100%{transform:scale(1)}}
  .card-wishlist.wished{color:#ef4444;border-color:#ef4444;animation:wish-pop .35s ease}
  .wish-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#1e293b;color:#f8fafc;padding:10px 20px;border-radius:24px;font-size:14px;font-weight:600;z-index:9999;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;white-space:nowrap}
  .wish-toast--visible{opacity:1;transform:translateX(-50%) translateY(0)}
  .wish-badge{position:absolute;top:-6px;right:-8px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;line-height:1}
  .header__action{position:relative}
  ```

- [ ] **Step 2: Vérifier pas de doublon**

  ```powershell
  node -e "const s=require('fs').readFileSync('style.css','utf8'); console.log('wish-toast:', (s.match(/wish-toast/g)||[]).length, '| wish-badge:', (s.match(/wish-badge/g)||[]).length);"
  ```
  Attendu : `wish-toast: 2 | wish-badge: 1`

---

## Task 3 : Modifier `js/catalog.js`

**Files:** Modify `js/catalog.js`

Deux modifications :

**3A — Bouton wishlist dans productCard() (~ligne 147)**

Remplacer le bouton textContent ♡/♥ avec inline style par un bouton avec SVG coeur et classe CSS :
- Garder `class="card-wishlist"`, ajouter `wished` si liked
- Garder `data-id`, `onclick="toggleWish(this)"`
- Remplacer textContent par SVG path du coeur (fill="#ef4444" si wished, fill="none" sinon)
- Supprimer `style="${wished ? '...' : ''}"` — utiliser classe CSS à la place
- aria-label dynamique : "Retirer des favoris" si wished, "Ajouter aux favoris" sinon

**3B — Remplacer window.toggleWish (~lignes 330-343)**

La nouvelle fonction :
1. Lit id depuis `btn.dataset.id`
2. Remonte au `.product-card` parent via `btn.closest('.product-card')`
3. Lit depuis le DOM : name (.card-title), brand (.card-brand), price_eur (.price-main texte parsé), price_kmf (.price-kmf texte parsé), img (.card-img img src), stock (.card-stock texte et className)
4. Appelle `window.Wishlist.toggle(id, productData)` — avec fallback _wishFallback() si Wishlist non défini
5. Met à jour le SVG (fill selon added), toggle classe `wished`, met à jour aria-label
6. `_wishFallback()` est une fonction locale qui implémente toggle minimal sur localStorage (garde rétrocompatibilité si wishlist.js non chargé)

- [ ] **Step 1: Modifier productCard() — le bouton wishlist**

  (Voir description 3A ci-dessus)

- [ ] **Step 2: Remplacer window.toggleWish**

  (Voir description 3B ci-dessus)

- [ ] **Step 3: Vérifier syntaxe**

  ```powershell
  node --check js/catalog.js
  ```
  Attendu : aucune sortie

---

## Task 4 : Nettoyer `index.html`

**Files:** Modify `index.html`

- [ ] **Step 1: Supprimer les deux blocs inline toggleWish**

  Bloc 1 (~ligne 1081) : supprime le `// Favoris toggle` + forEach addEventListener qui fait textContent ♡/♥
  Bloc 2 (~ligne 1152) : supprime le `// Réattache favoris` + forEach addEventListener similaire

- [ ] **Step 2: Ajouter wishlist.js dans le head**

  Après `<script src="/js/nav.js` ... ajouter :
  ```html
  <script src="/js/wishlist.js?v=1" defer></script>
  ```

- [ ] **Step 3: Vérifier absence d'ancien code**

  ```powershell
  node -e "const s=require('fs').readFileSync('index.html','utf8'); const old=(s.match(/textContent.*==.*u2661/g)||[]).length; console.log('toggleWish inline restant:', old);"
  ```
  Attendu : `toggleWish inline restant: 0`

---

## Task 5 : Ajouter wishlist.js dans les 12 HTML catalog

**Files:** Modify composants.html, digital.html, ecrans.html, imprimantes.html, ordinateurs.html, peripheriques.html, promotions.html, protection.html, reconditionnes.html, reseau.html, services.html, stockage.html

- [ ] **Step 1: Dans chaque fichier, ajouter après le script nav.js dans le head**

  ```html
  <script src="/js/wishlist.js?v=1" defer></script>
  ```

- [ ] **Step 2: Vérifier que tous les fichiers l'ont**

  ```powershell
  $files=@("composants.html","digital.html","ecrans.html","imprimantes.html","ordinateurs.html","peripheriques.html","promotions.html","protection.html","reconditionnes.html","reseau.html","services.html","stockage.html","index.html"); foreach($f in $files){$has=(Get-Content $f -Raw) -match 'wishlist\.js'; Write-Host "$f : $(if($has){'OK'}else{'MANQUANT'})"}
  ```
  Attendu : tous `OK`

---

## Task 6 : Créer `favoris.html`

**Files:** Create `favoris.html`

Page standalone (pas de catalog.js). Structure identique aux autres pages : header avec logo + actions, nav via nav.js, contenu principal.

Comportement :
- Au chargement : lit `window.Wishlist.getList()` (synchrone, localStorage)
- Si liste vide : affiche message + CTA vers index.html
- Si non vide : affiche une grille de cartes produits (img, brand, name, price EUR + KMF, bouton "Voir le détail" → produit.html?id=X, bouton "✕ Retirer")
- Bouton "Tout supprimer" en haut à droite (visible seulement si liste non vide), avec confirmation `confirm()`
- `removeItem(id)` : appelle Wishlist.toggle(id, existing) pour retirer, rerender
- `clearAll()` : vide localStorage directement, rerender
- Enregistre `render` via `Wishlist.on(render)` pour sync si ouvert sur une autre page

Header de favoris.html : liens "Favoris" (href favoris.html, actif) et "Panier" (href checkout.html, avec .cart-badge)

Scripts chargés : wishlist.js (sync, avant le script inline), nav.js defer, cart.js defer, cart-ui.js defer

CSS critique inline dans head couvre : .header, .header__action, .header__logo, .wish-grid, .wish-card, .wish-empty, .btn-clear, .wish-badge, .cart-badge

- [ ] **Step 1: Créer favoris.html avec toute la structure décrite**

- [ ] **Step 2: Ouvrir dans navigateur, vérifier console (F12) sans erreur**

- [ ] **Step 3: Tester — ajouter un favori sur index.html, naviguer vers favoris.html, vérifier la carte apparaît**

---

## Task 7 : Commit

- [ ] **Step 1: Vérifier syntaxe globale**

  ```powershell
  node --check js/wishlist.js; node --check js/catalog.js
  ```

- [ ] **Step 2: Vérifier poids de wishlist.js (doit etre < 5KB)**

  ```powershell
  Get-Item js/wishlist.js | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB,2)}}
  ```

- [ ] **Step 3: Commit**

  ```powershell
  git add js/wishlist.js favoris.html js/catalog.js style.css index.html composants.html digital.html ecrans.html imprimantes.html ordinateurs.html peripheriques.html promotions.html protection.html reconditionnes.html reseau.html services.html stockage.html
  git commit -m "feat(wishlist): bouton favori actif — animation, toast, compteur header, page favoris.html"
  ```

---

## Self-Review

- ✅ Animation bouton — @keyframes wish-pop + classe .wished (Task 2 + 3)
- ✅ Toast notification — _showToast() dans wishlist.js (Task 1)
- ✅ Compteur header — _initNavBadge() + _updateNavBadge() (Task 1)
- ✅ Page Mes Favoris — favoris.html (Task 6)
- ✅ localStorage uniquement — aucun appel API
- ✅ Migration données existantes — _read() migre string[] vers objet[]
- ✅ 0 dépendance externe — vanilla JS
- ✅ Score PageSpeed préservé — wishlist.js defer/2KB, CSS +500B, favoris.html noindex
- ✅ Pas de double fetch — favoris.html lit localStorage directement
- ✅ Types cohérents — toggle(id, productData) retourne {added} partout
