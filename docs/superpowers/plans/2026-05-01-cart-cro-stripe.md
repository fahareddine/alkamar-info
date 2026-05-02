# Cart + CRO + Stripe Test Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un panier fonctionnel (localStorage), des optimisations de conversion (CRO) et un tunnel Stripe en mode TEST complet de A à Z.

**Architecture:** Panier JS pur avec localStorage + drawer CSS vanilla. CRO via triggers JS injectés dans les fiches produit. Stripe via un endpoint Vercel `/api/checkout.js` qui crée une CheckoutSession et redirige l'utilisateur vers Stripe Hosted Checkout.

**Tech Stack:** JavaScript ES vanilla, CSS custom, Vercel Serverless (Node.js), Stripe SDK v14, Supabase (pour récupérer les produits), localStorage pour panier client.

---

## Prérequis avant de commencer

- Créer un compte Stripe gratuit sur https://dashboard.stripe.com
- Récupérer les clés TEST dans Dashboard → Developers → API keys :
  - `STRIPE_SECRET_KEY` = `sk_test_...`
  - `STRIPE_PUBLISHABLE_KEY` = `pk_test_...`
- Ajouter dans `.env.local` et dans Vercel Dashboard (Settings → Environment Variables)

---

## File Map

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `js/cart.js` | Créer | Logique panier : add/remove/update/persist |
| `js/cart-ui.js` | Créer | Drawer HTML, animations, badge |
| `js/cro.js` | Créer | Urgence, rareté, social proof, sticky CTA |
| `api/checkout.js` | Créer | Endpoint Stripe CreateCheckoutSession |
| `api/stripe-webhook.js` | Créer | Webhook Stripe (confirmations) |
| `success.html` | Créer | Page confirmation commande |
| `cancel.html` | Créer | Page annulation / retour panier |
| `style.css` | Modifier | Styles drawer + CRO badges + sticky CTA |
| `js/catalog.js` | Modifier | Connecte btn-cart au système panier |
| `produit.html` | Modifier | CRO fiche produit + sticky add-to-cart |
| `index.html` | Modifier | Hero CRO + reassurance visible |
| `.env.local` | Modifier | Ajouter STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY |
| `package.json` | Modifier | Ajouter stripe comme dépendance |

---

## Task 1 : Installation Stripe SDK

**Files:**
- Modify: `package.json`

- [ ] **Étape 1 : Installer Stripe**

```bash
npm install stripe
```

- [ ] **Étape 2 : Vérifier package.json**

`package.json` doit contenir :
```json
"dependencies": {
  "stripe": "^14.0.0"
}
```

- [ ] **Étape 3 : Ajouter clés dans .env.local**

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_VOTRE_CLE_ICI
STRIPE_PUBLISHABLE_KEY=pk_test_VOTRE_CLE_ICI
```

- [ ] **Étape 4 : Commit**
```bash
git add package.json package-lock.json
git commit -m "chore: install stripe sdk"
```

---

## Task 2 : Système panier (cart.js)

**Files:**
- Create: `js/cart.js`

- [ ] **Étape 1 : Créer js/cart.js**

```javascript
// js/cart.js — Gestion panier localStorage
const CART_KEY = 'alkamar_cart';

const Cart = (function () {

  function load() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }

  function save(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { items } }));
  }

  function add(product) {
    // product = { id, legacy_id, name, price_eur, price_kmf, main_image_url, brand }
    const items = load();
    const idx = items.findIndex(i => i.id === product.id);
    if (idx >= 0) {
      items[idx].qty = (items[idx].qty || 1) + 1;
    } else {
      items.push({ ...product, qty: 1 });
    }
    save(items);
    return items;
  }

  function remove(id) {
    const items = load().filter(i => i.id !== id);
    save(items);
    return items;
  }

  function updateQty(id, qty) {
    const items = load();
    const idx = items.findIndex(i => i.id === id);
    if (idx < 0) return items;
    if (qty <= 0) return remove(id);
    items[idx].qty = qty;
    save(items);
    return items;
  }

  function clear() {
    save([]);
  }

  function total() {
    return load().reduce((sum, i) => sum + (i.price_eur || 0) * (i.qty || 1), 0);
  }

  function count() {
    return load().reduce((sum, i) => sum + (i.qty || 1), 0);
  }

  return { load, add, remove, updateQty, clear, total, count };
})();

window.Cart = Cart;
```

- [ ] **Étape 2 : Tester manuellement dans la console**

Ouvrir https://alkamar-info.vercel.app dans un navigateur de test local, puis dans DevTools Console :
```javascript
Cart.add({ id: 'test-1', name: 'Test', price_eur: 29.99 });
Cart.load(); // doit retourner [{ id:'test-1', name:'Test', price_eur:29.99, qty:1 }]
Cart.count(); // doit retourner 1
Cart.total(); // doit retourner 29.99
Cart.remove('test-1');
Cart.load(); // doit retourner []
```

- [ ] **Étape 3 : Commit**
```bash
git add js/cart.js
git commit -m "feat(cart): système panier localStorage"
```

---

## Task 3 : Drawer panier (cart-ui.js + CSS)

**Files:**
- Create: `js/cart-ui.js`
- Modify: `style.css`

- [ ] **Étape 1 : Ajouter CSS drawer dans style.css**

Ajouter à la fin de `style.css` :
```css
/* ── CART DRAWER ─────────────────────────────────────── */
.cart-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.45);
  z-index: 1200; opacity: 0; pointer-events: none;
  transition: opacity .25s;
}
.cart-overlay.open { opacity: 1; pointer-events: all; }

.cart-drawer {
  position: fixed; top: 0; right: 0; width: 400px; max-width: 95vw;
  height: 100%; background: #fff; z-index: 1300;
  transform: translateX(100%); transition: transform .3s ease;
  display: flex; flex-direction: column; box-shadow: -8px 0 32px rgba(0,0,0,.18);
}
.cart-drawer.open { transform: translateX(0); }

.cart-drawer__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px; border-bottom: 1px solid #e5e7eb;
  font-size: 16px; font-weight: 700; color: #0f172a;
}
.cart-drawer__close {
  background: none; border: none; font-size: 22px; cursor: pointer;
  color: #6b7280; line-height: 1; padding: 4px 8px;
  border-radius: 6px; transition: background .15s;
}
.cart-drawer__close:hover { background: #f1f5f9; }

.cart-drawer__body { flex: 1; overflow-y: auto; padding: 16px; }

.cart-item {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 12px 0; border-bottom: 1px solid #f1f5f9;
}
.cart-item__img {
  width: 64px; height: 52px; object-fit: contain;
  background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;
  flex-shrink: 0; padding: 4px;
}
.cart-item__info { flex: 1; min-width: 0; }
.cart-item__name {
  font-size: 13px; font-weight: 600; color: #0f172a;
  margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cart-item__price { font-size: 14px; font-weight: 800; color: var(--red); }
.cart-item__qty {
  display: flex; align-items: center; gap: 8px; margin-top: 8px;
}
.cart-qty-btn {
  width: 26px; height: 26px; border: 1px solid #d1d5db; border-radius: 6px;
  background: #f9fafb; font-size: 16px; cursor: pointer; display: flex;
  align-items: center; justify-content: center; transition: all .15s;
}
.cart-qty-btn:hover { background: #e5e7eb; }
.cart-qty-val { font-size: 13px; font-weight: 700; min-width: 20px; text-align: center; }
.cart-item__remove {
  background: none; border: none; color: #9ca3af; cursor: pointer;
  font-size: 16px; padding: 4px; transition: color .15s;
  flex-shrink: 0;
}
.cart-item__remove:hover { color: #ef4444; }

.cart-drawer__empty {
  text-align: center; padding: 48px 20px; color: #6b7280; font-size: 14px;
}
.cart-drawer__empty svg { width: 48px; height: 48px; color: #d1d5db; margin: 0 auto 12px; display: block; }

.cart-drawer__footer {
  padding: 16px 20px; border-top: 2px solid #e5e7eb;
  background: #fff;
}
.cart-total-line {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 14px;
}
.cart-total-line .total-eur { color: var(--primary); font-size: 1.4rem; }
.btn-checkout {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 14px; background: var(--primary); color: #fff;
  border: none; border-radius: 8px; font-size: 15px; font-weight: 800;
  cursor: pointer; transition: background .15s; font-family: inherit;
}
.btn-checkout:hover { background: var(--primary-dark); }
.btn-checkout svg { width: 18px; height: 18px; }
.btn-continue-shopping {
  display: block; text-align: center; margin-top: 10px;
  font-size: 13px; color: var(--text-muted); cursor: pointer;
  text-decoration: underline; background: none; border: none;
  font-family: inherit; width: 100%;
}

/* Badge panier animé */
.cart-badge { transition: transform .2s; }
.cart-badge.bump { transform: scale(1.4); }

/* Sticky Add to Cart mobile */
.sticky-atc {
  display: none;
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 800;
  padding: 12px 16px; background: #fff;
  box-shadow: 0 -4px 20px rgba(0,0,0,.12);
  border-top: 1px solid #e5e7eb;
}
@media (max-width: 768px) { .sticky-atc { display: flex; gap: 10px; } }
.sticky-atc .btn-cart { flex: 1; padding: 13px; font-size: 14px; }
.sticky-atc .sticky-price { font-size: 1.1rem; font-weight: 900; color: var(--primary); white-space: nowrap; display: flex; align-items: center; }
```

- [ ] **Étape 2 : Créer js/cart-ui.js**

```javascript
// js/cart-ui.js — UI Drawer panier
(function () {
  'use strict';

  let drawerEl, overlayEl, badgeEls;

  function init() {
    injectDrawer();
    drawerEl  = document.getElementById('cart-drawer');
    overlayEl = document.getElementById('cart-overlay');
    badgeEls  = document.querySelectorAll('.cart-badge');

    overlayEl.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    document.querySelectorAll('[data-cart-open]').forEach(btn => btn.addEventListener('click', open));
    window.addEventListener('cart:updated', () => render());

    render();
  }

  function injectDrawer() {
    if (document.getElementById('cart-drawer')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="cart-overlay" class="cart-overlay"></div>
      <div id="cart-drawer" class="cart-drawer" role="dialog" aria-label="Panier">
        <div class="cart-drawer__header">
          <span>🛒 Mon Panier</span>
          <button class="cart-drawer__close" onclick="CartUI.close()">✕</button>
        </div>
        <div class="cart-drawer__body" id="cart-drawer-body"></div>
        <div class="cart-drawer__footer" id="cart-drawer-footer"></div>
      </div>`);
  }

  function open() {
    render();
    drawerEl?.classList.add('open');
    overlayEl?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    drawerEl?.classList.remove('open');
    overlayEl?.classList.remove('open');
    document.body.style.overflow = '';
  }

  function render() {
    const items = typeof Cart !== 'undefined' ? Cart.load() : [];
    const count = items.reduce((s, i) => s + (i.qty || 1), 0);
    const total = items.reduce((s, i) => s + (i.price_eur || 0) * (i.qty || 1), 0);

    // Mise à jour badges
    document.querySelectorAll('.cart-badge').forEach(b => {
      b.textContent = count;
      if (count > 0) {
        b.classList.add('bump');
        setTimeout(() => b.classList.remove('bump'), 300);
      }
    });

    const body   = document.getElementById('cart-drawer-body');
    const footer = document.getElementById('cart-drawer-footer');
    if (!body || !footer) return;

    if (!items.length) {
      body.innerHTML = `<div class="cart-drawer__empty">
        <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>
        <p>Votre panier est vide</p>
        <button class="btn-continue-shopping" onclick="CartUI.close()">Continuer les achats</button>
      </div>`;
      footer.innerHTML = '';
      return;
    }

    body.innerHTML = items.map(item => `
      <div class="cart-item">
        <img class="cart-item__img" src="${item.main_image_url || item.image || ''}" alt="${item.name}" onerror="this.style.display='none'">
        <div class="cart-item__info">
          <div class="cart-item__name">${item.name}</div>
          <div class="cart-item__price">${(item.price_eur||0).toFixed(2).replace('.',',')} €</div>
          <div class="cart-item__qty">
            <button class="cart-qty-btn" onclick="CartUI.decrement('${item.id}')">−</button>
            <span class="cart-qty-val">${item.qty}</span>
            <button class="cart-qty-btn" onclick="CartUI.increment('${item.id}')">+</button>
          </div>
        </div>
        <button class="cart-item__remove" onclick="CartUI.removeItem('${item.id}')" title="Retirer">🗑</button>
      </div>`).join('');

    footer.innerHTML = `
      <div class="cart-total-line">
        <span>Total</span>
        <span class="total-eur">${total.toFixed(2).replace('.',',')} €</span>
      </div>
      <button class="btn-checkout" onclick="CartUI.checkout()">
        <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
        Payer maintenant
      </button>
      <button class="btn-continue-shopping" onclick="CartUI.close()">← Continuer les achats</button>`;
  }

  function removeItem(id) {
    if (typeof Cart !== 'undefined') Cart.remove(id);
    render();
  }

  function increment(id) {
    if (typeof Cart !== 'undefined') {
      const item = Cart.load().find(i => i.id === id);
      if (item) Cart.updateQty(id, (item.qty || 1) + 1);
    }
    render();
  }

  function decrement(id) {
    if (typeof Cart !== 'undefined') {
      const item = Cart.load().find(i => i.id === id);
      if (item) Cart.updateQty(id, (item.qty || 1) - 1);
    }
    render();
  }

  async function checkout() {
    const items = typeof Cart !== 'undefined' ? Cart.load() : [];
    if (!items.length) return;
    const btn = document.querySelector('.btn-checkout');
    if (btn) { btn.disabled = true; btn.textContent = 'Chargement…'; }
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; }
      else { alert('Erreur paiement : ' + (data.error || 'inconnu')); }
    } catch(e) {
      alert('Erreur réseau. Réessayez.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Payer maintenant'; }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  window.CartUI = { open, close, render, removeItem, increment, decrement, checkout };
})();
```

- [ ] **Étape 3 : Ajouter data-cart-open sur le bouton panier dans tous les HTML**

Dans chaque fichier HTML, trouver le bouton panier dans le header et ajouter `data-cart-open` :
```html
<!-- Avant -->
<a href="#" class="header__action">
  <span>Panier</span>
  <span class="cart-badge">0</span>
</a>
<!-- Après -->
<button data-cart-open class="header__action" style="background:none;border:none;cursor:pointer">
  <svg ...></svg>
  <span>Panier</span>
  <span class="cart-badge">0</span>
</button>
```

- [ ] **Étape 4 : Commit**
```bash
git add js/cart-ui.js style.css
git commit -m "feat(cart): drawer UI + styles"
```

---

## Task 3 : Connecter catalog.js au panier

**Files:**
- Modify: `js/catalog.js`

- [ ] **Étape 1 : Modifier la fonction addToCart dans initPage()**

Dans `js/catalog.js`, remplacer `window.addToCart` par :
```javascript
window.addToCart = function(btn, id) {
  // Trouver le produit depuis le DOM de la carte
  const card = btn.closest('.product-card');
  const name  = card?.querySelector('.card-title')?.textContent?.trim() || '';
  const brand = card?.querySelector('.card-brand')?.textContent?.trim() || '';
  const priceText = card?.querySelector('.price-main')?.textContent?.replace(/[^\d,.]/g,'').replace(',','.') || '0';
  const img   = card?.querySelector('.card-img img')?.src || '';
  const product = {
    id    : id || String(Date.now()),
    name,
    brand,
    price_eur: parseFloat(priceText) || 0,
    main_image_url: img,
  };
  if (typeof Cart !== 'undefined') Cart.add(product);
  if (typeof CartUI !== 'undefined') CartUI.open();

  // Animation bouton
  if (btn) {
    btn.textContent = '✓ Ajouté';
    btn.style.background = '#059669';
    setTimeout(() => {
      btn.innerHTML = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg> Ajouter';
      btn.style.background = '';
    }, 1500);
  }
};
```

- [ ] **Étape 2 : Tester — ajouter un produit déclenche le drawer**

Ouvrir https://alkamar-info.vercel.app, cliquer "Ajouter" sur un produit → drawer s'ouvre avec le produit dedans.

- [ ] **Étape 3 : Commit**
```bash
git add js/catalog.js
git commit -m "feat(cart): connecte catalog addToCart au système panier"
```

---

## Task 4 : Inclure cart.js + cart-ui.js dans toutes les pages

**Files:**
- Modify: `index.html`, `ordinateurs.html`, `composants.html`, `ecrans.html`, `peripheriques.html`, `reseau.html`, `stockage.html`, `protection.html`, `reconditionnes.html`, `promotions.html`, `services.html`, `produit.html`, `imprimantes.html`

- [ ] **Étape 1 : Ajouter les scripts dans chaque fichier HTML avant `</body>`**

```bash
# Commande sed pour ajouter cart.js + cart-ui.js avant js/catalog.js dans tous les HTML
sed -i 's|<script src="js/catalog.js">|<script src="js/cart.js"></script>\n  <script src="js/cart-ui.js"></script>\n  <script src="js/catalog.js">|g' *.html
```

- [ ] **Étape 2 : Convertir le lien panier en bouton dans nav.js**

Dans `js/nav.js`, la partie QUICK_CATS et NAV_HTML — le panier doit déclencher le drawer :
```javascript
// Dans header__actions (nav.js), le bouton panier :
<button data-cart-open class="header__action" style="background:none;border:none;cursor:pointer;font-family:inherit">
  <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
  <span>Panier</span>
  <span class="cart-badge">0</span>
</button>
```

- [ ] **Étape 3 : Commit**
```bash
git add *.html js/nav.js
git commit -m "feat(cart): inclut cart.js + cart-ui.js dans toutes les pages"
```

---

## Task 5 : Endpoint Stripe /api/checkout.js

**Files:**
- Create: `api/checkout.js`

**Prérequis :** `STRIPE_SECRET_KEY=sk_test_...` dans `.env.local` + Vercel env vars.

- [ ] **Étape 1 : Créer api/checkout.js**

```javascript
// api/checkout.js — Stripe Checkout Session
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Panier vide' });
  }

  try {
    const line_items = items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name || 'Produit',
          description: item.brand || undefined,
          images: item.main_image_url ? [item.main_image_url] : [],
        },
        unit_amount: Math.round((item.price_eur || 0) * 100), // en centimes
      },
      quantity: item.qty || 1,
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/cancel.html`,
      locale: 'fr',
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['KM', 'FR', 'RE', 'MQ', 'GP', 'YT', 'MG'],
      },
      custom_text: {
        submit: { message: 'Mode TEST — utilisez 4242 4242 4242 4242 comme carte de test' },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[checkout] Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
```

- [ ] **Étape 2 : Tester l'endpoint**

```bash
curl -X POST https://alkamar-info.vercel.app/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"items":[{"name":"Test Produit","price_eur":29.99,"qty":1}]}'
# Doit retourner {"url":"https://checkout.stripe.com/..."}
```

- [ ] **Étape 3 : Commit**
```bash
git add api/checkout.js
git commit -m "feat(stripe): endpoint checkout session mode test"
```

---

## Task 6 : Pages success.html et cancel.html

**Files:**
- Create: `success.html`
- Create: `cancel.html`

- [ ] **Étape 1 : Créer success.html**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commande confirmée — La Boutique</title>
  <link rel="stylesheet" href="style.css">
  <style>
    .success-page { max-width: 600px; margin: 80px auto; padding: 0 20px; text-align: center; }
    .success-icon { font-size: 64px; margin-bottom: 24px; }
    .success-title { font-size: 1.8rem; font-weight: 900; color: #059669; margin-bottom: 12px; }
    .success-text { font-size: 15px; color: #64748b; line-height: 1.7; margin-bottom: 32px; }
    .success-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; margin-bottom: 32px; }
    .success-note { font-size: 12px; color: #94a3b8; margin-top: 24px; }
  </style>
</head>
<body>
  <header class="header" style="position:relative">
    <div class="header__inner">
      <a href="index.html" class="logo">
        <div class="logo__icon">B</div>
        <span class="logo__text">La <span>Boutique</span></span>
      </a>
    </div>
  </header>
  <main class="success-page">
    <div class="success-icon">✅</div>
    <h1 class="success-title">Commande confirmée !</h1>
    <div class="success-card">
      <p class="success-text">
        Merci pour votre commande. Vous recevrez un email de confirmation sous peu.<br>
        Notre équipe traite votre commande et vous contactera pour la livraison.
      </p>
      <p><strong>📞 +269 377 57 04</strong> — Questions ? Appelez-nous !</p>
    </div>
    <a href="index.html" class="btn-voir-tout" style="display:inline-flex">
      ← Retour à la boutique
    </a>
    <p class="success-note">⚠️ Mode TEST Stripe — aucun vrai paiement n'a été effectué</p>
  </main>
  <script>
    // Vide le panier après succès
    try { localStorage.removeItem('alkamar_cart'); } catch {}
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: [] } }));
  </script>
</body>
</html>
```

- [ ] **Étape 2 : Créer cancel.html**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paiement annulé — La Boutique</title>
  <link rel="stylesheet" href="style.css">
  <style>
    .cancel-page { max-width: 600px; margin: 80px auto; padding: 0 20px; text-align: center; }
    .cancel-icon { font-size: 64px; margin-bottom: 24px; }
    .cancel-title { font-size: 1.8rem; font-weight: 900; color: #ef4444; margin-bottom: 12px; }
    .cancel-text { font-size: 15px; color: #64748b; line-height: 1.7; margin-bottom: 32px; }
    .btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  </style>
</head>
<body>
  <header class="header" style="position:relative">
    <div class="header__inner">
      <a href="index.html" class="logo">
        <div class="logo__icon">B</div>
        <span class="logo__text">La <span>Boutique</span></span>
      </a>
    </div>
  </header>
  <main class="cancel-page">
    <div class="cancel-icon">🛒</div>
    <h1 class="cancel-title">Paiement annulé</h1>
    <p class="cancel-text">
      Votre paiement a été annulé. Votre panier est toujours sauvegardé.<br>
      Vous pouvez reprendre votre commande à tout moment.
    </p>
    <div class="btns">
      <button onclick="history.back()" class="btn-voir-tout">← Retour au panier</button>
      <a href="index.html" class="btn-cart" style="display:inline-flex;align-items:center;text-decoration:none">Continuer les achats</a>
    </div>
    <p style="margin-top:24px;font-size:12px;color:#94a3b8">
      📞 Besoin d'aide ? +269 377 57 04
    </p>
  </main>
</body>
</html>
```

- [ ] **Étape 3 : Commit**
```bash
git add success.html cancel.html
git commit -m "feat(stripe): pages success et cancel"
```

---

## Task 7 : CRO — Triggers psychologiques (cro.js)

**Files:**
- Create: `js/cro.js`

- [ ] **Étape 1 : Créer js/cro.js**

```javascript
// js/cro.js — Triggers CRO : urgence, rareté, social proof
(function () {
  'use strict';

  // ── Urgence : compte à rebours 24h ───────────────────
  function injectCountdown() {
    const banner = document.querySelector('.promo-banner, .subcat-header');
    if (!banner || document.getElementById('cro-countdown')) return;

    // Récupère ou crée l'expiration à 24h
    let exp = parseInt(localStorage.getItem('cro_exp') || '0');
    if (!exp || exp < Date.now()) {
      exp = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem('cro_exp', exp);
    }

    const div = document.createElement('div');
    div.id = 'cro-countdown';
    div.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#fde68a;margin-top:8px;';
    div.innerHTML = `⏰ Offre expire dans <span id="cd-time" style="font-size:15px;color:#fff"></span>`;
    banner.querySelector('.subcat-header__inner, .promo-banner__inner')?.appendChild(div);

    function tick() {
      const diff = Math.max(0, exp - Date.now());
      const h = String(Math.floor(diff / 3600000)).padStart(2,'0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2,'0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2,'0');
      const el = document.getElementById('cd-time');
      if (el) el.textContent = `${h}:${m}:${s}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  // ── Rareté : "X en stock" sur les cartes ─────────────
  function injectScarcity() {
    document.querySelectorAll('.product-card').forEach(card => {
      if (card.querySelector('.cro-scarcity')) return;
      const stockEl = card.querySelector('.card-stock');
      if (!stockEl) return;
      const txt = stockEl.textContent || '';
      if (txt.includes('limité') || txt.includes('out')) return;

      // Simule un stock entre 2 et 7 basé sur le nom
      const name = card.querySelector('.card-title')?.textContent || '';
      const hash = [...name].reduce((a,c) => a + c.charCodeAt(0), 0);
      const qty = (hash % 6) + 2;

      if (qty <= 5) {
        const scarcity = document.createElement('div');
        scarcity.className = 'cro-scarcity';
        scarcity.style.cssText = 'font-size:11px;font-weight:700;color:#d97706;display:flex;align-items:center;gap:4px;margin-bottom:4px;';
        scarcity.innerHTML = `🔥 Plus que ${qty} en stock`;
        stockEl.insertAdjacentElement('beforebegin', scarcity);
      }
    });
  }

  // ── Social proof : vues en temps réel simulées ────────
  function injectSocialProof() {
    document.querySelectorAll('.product-card').forEach(card => {
      if (card.querySelector('.cro-views')) return;
      const body = card.querySelector('.card-body');
      if (!body) return;
      const name = card.querySelector('.card-title')?.textContent || '';
      const hash = [...name].reduce((a,c) => a + c.charCodeAt(0), 0);
      const viewers = (hash % 12) + 3;

      const div = document.createElement('div');
      div.className = 'cro-views';
      div.style.cssText = 'font-size:10px;color:#6b7280;display:flex;align-items:center;gap:4px;margin-bottom:4px;';
      div.innerHTML = `👁 ${viewers} personnes regardent en ce moment`;
      body.insertBefore(div, body.firstChild);
    });
  }

  // ── Best seller badge injection ────────────────────────
  function injectBestSeller() {
    const cards = [...document.querySelectorAll('.product-card')];
    // 1er produit de chaque grille = best seller
    const grids = document.querySelectorAll('.products-grid, .products-grid--5, .products-grid--4');
    grids.forEach(grid => {
      const first = grid.querySelector('.product-card');
      if (!first) return;
      const badges = first.querySelector('.card-badges');
      if (!badges) return;
      if (badges.querySelector('.badge')) return; // déjà un badge
      badges.innerHTML = '<span class="badge badge--best">🏆 Top vente</span>';
    });
  }

  // ── Observer pour appliquer sur chargement dynamique ──
  function observe() {
    const grids = document.querySelectorAll('.products-grid, .products-grid--5, .products-grid--4, #grid-promo');
    grids.forEach(grid => {
      const obs = new MutationObserver(() => {
        setTimeout(() => { injectScarcity(); injectSocialProof(); injectBestSeller(); }, 100);
      });
      obs.observe(grid, { childList: true });
    });
  }

  function init() {
    injectCountdown();
    injectScarcity();
    injectSocialProof();
    injectBestSeller();
    observe();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  // Re-apply après chargement produits dynamiques
  window.addEventListener('catalog:rendered', init);
})();
```

- [ ] **Étape 2 : Inclure cro.js dans index.html et pages catégories**

```bash
sed -i 's|<script src="js/sidebar.js" defer>|<script src="js/cro.js" defer></script>\n  <script src="js/sidebar.js" defer>|g' index.html ordinateurs.html composants.html ecrans.html peripheriques.html reseau.html stockage.html protection.html reconditionnes.html
```

- [ ] **Étape 3 : Commit**
```bash
git add js/cro.js *.html
git commit -m "feat(cro): urgence, rareté, social proof, best seller"
```

---

## Task 8 : Sticky CTA mobile sur fiche produit

**Files:**
- Modify: `produit.html`

- [ ] **Étape 1 : Ajouter sticky add-to-cart dans produit.html**

Avant `</body>` dans `produit.html`, ajouter :
```html
<div class="sticky-atc" id="sticky-atc" style="display:none">
  <span class="sticky-price" id="sticky-price"></span>
  <button class="btn-cart" id="sticky-add-btn" style="flex:1;padding:13px;font-size:14px">
    🛒 Ajouter au panier
  </button>
</div>

<script>
  // Affiche le sticky CTA quand le bouton principal sort du viewport
  const stickyAtc  = document.getElementById('sticky-atc');
  const stickyBtn  = document.getElementById('sticky-add-btn');
  const stickyPrice = document.getElementById('sticky-price');

  function setupSticky(product, mainBtn) {
    if (!stickyAtc || !product) return;
    if (stickyPrice) stickyPrice.textContent = (product.price_eur || 0).toFixed(2).replace('.',',') + ' €';
    if (stickyBtn) {
      stickyBtn.onclick = () => {
        if (typeof Cart !== 'undefined') Cart.add({
          id: product.legacy_id || product.id,
          name: product.name,
          brand: product.brand,
          price_eur: product.price_eur,
          main_image_url: product.main_image_url || product.image,
        });
        if (typeof CartUI !== 'undefined') CartUI.open();
      };
    }
    if (mainBtn) {
      const obs = new IntersectionObserver(entries => {
        stickyAtc.style.display = entries[0].isIntersecting ? 'none' : 'flex';
      }, { threshold: 0.5 });
      obs.observe(mainBtn);
    }
  }
  window._setupStickyAtc = setupSticky;
</script>
```

- [ ] **Étape 2 : Connecter setupSticky depuis le JS de la fiche produit**

Dans le script inline de `produit.html`, après avoir rendu le contenu du produit, appeler :
```javascript
// Après document.getElementById('product-content').innerHTML = `...`
const mainCartBtn = document.querySelector('.btn-add-cart');
if (window._setupStickyAtc) window._setupStickyAtc(p, mainCartBtn);
```

- [ ] **Étape 3 : Commit**
```bash
git add produit.html
git commit -m "feat(cro): sticky add-to-cart mobile fiche produit"
```

---

## Task 9 : Hero CRO sur index.html

**Files:**
- Modify: `index.html`

- [ ] **Étape 1 : Améliorer le message hero**

Dans `index.html`, la section `.promo-banner` :
```html
<!-- Remplacer le contenu .promo-banner__inner par : -->
<div class="promo-banner__inner">
  <div>
    <span class="promo-banner__tag">⚡ Ventes Flash</span>
    <h1 class="promo-banner__title">Matériel Info <span>aux Comores</span></h1>
    <p class="promo-banner__sub">✅ Livraison rapide · 🔒 Paiement sécurisé · ♻️ Reconditionnés testés</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
      <span style="background:rgba(255,255,255,.15);border-radius:6px;padding:6px 12px;font-size:12px;font-weight:700">💳 Mobile Money accepté</span>
      <span style="background:rgba(255,255,255,.15);border-radius:6px;padding:6px 12px;font-size:12px;font-weight:700">🛡️ Garantie 12–24 mois</span>
      <span style="background:rgba(255,255,255,.15);border-radius:6px;padding:6px 12px;font-size:12px;font-weight:700">📞 +269 377 57 04</span>
    </div>
  </div>
  <a href="#produits" class="promo-banner__cta">
    Voir les produits
    <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5-5 5M6 12h12"/></svg>
  </a>
</div>
```

- [ ] **Étape 2 : Commit**
```bash
git add index.html
git commit -m "feat(cro): hero value proposition + trust badges"
```

---

## Task 10 : Deploy + Test Stripe end-to-end

- [ ] **Étape 1 : Ajouter STRIPE_PUBLISHABLE_KEY dans .env.local**
```bash
echo "STRIPE_PUBLISHABLE_KEY=pk_test_..." >> .env.local
```

- [ ] **Étape 2 : Ajouter les deux clés Stripe dans Vercel Dashboard**
- Aller sur https://vercel.com/dashboard → projet → Settings → Environment Variables
- Ajouter : `STRIPE_SECRET_KEY` = `sk_test_...`
- Ajouter : `STRIPE_PUBLISHABLE_KEY` = `pk_test_...`

- [ ] **Étape 3 : Deploy production**
```bash
git add -A && git commit -m "chore: final deploy cart + cro + stripe"
vercel --prod
```

- [ ] **Étape 4 : Test E2E complet**
1. Ouvrir https://alkamar-info.vercel.app
2. Cliquer "Ajouter" sur 2 produits → drawer s'ouvre
3. Modifier quantité → total se met à jour
4. Cliquer "Payer maintenant"
5. Stripe Checkout s'ouvre avec les produits
6. Entrer carte test : `4242 4242 4242 4242` · exp `12/28` · CVC `123` · nom quelconque
7. Cliquer "Payer"
8. Redirection vers `/success.html` ✅
9. Panier vidé automatiquement ✅
10. Tester annulation → redirection `/cancel.html` ✅

- [ ] **Étape 5 : Vérifier dans Stripe Dashboard**
- Aller sur https://dashboard.stripe.com/test/payments
- La transaction apparaît avec statut "Succeeded" ✅

---

## Résumé des fichiers créés/modifiés

| Fichier | Action |
|---------|--------|
| `js/cart.js` | CRÉÉ — logique panier localStorage |
| `js/cart-ui.js` | CRÉÉ — drawer UI animations |
| `js/cro.js` | CRÉÉ — triggers psychologiques |
| `api/checkout.js` | CRÉÉ — Stripe CheckoutSession |
| `success.html` | CRÉÉ — confirmation commande |
| `cancel.html` | CRÉÉ — annulation |
| `style.css` | MODIFIÉ — styles drawer + sticky CTA |
| `js/catalog.js` | MODIFIÉ — addToCart connecté au panier |
| `js/nav.js` | MODIFIÉ — bouton panier ouvre drawer |
| `produit.html` | MODIFIÉ — sticky CTA mobile |
| `index.html` | MODIFIÉ — hero CRO + trust badges |
| `*.html` (11 pages) | MODIFIÉ — include cart.js + cro.js |

---

## Cartes test Stripe

| Carte | Résultat |
|-------|----------|
| 4242 4242 4242 4242 | Paiement réussi ✅ |
| 4000 0000 0000 9995 | Refusé (fonds insuffisants) |
| 4000 0025 0000 3155 | Nécessite authentification 3DS |

Date d'expiration : n'importe quelle date future | CVC : n'importe quels 3 chiffres
