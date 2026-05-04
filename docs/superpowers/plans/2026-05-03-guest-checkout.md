# Guest Checkout Alkamar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux clients de commander sur Alkamar sans créer de compte, avec seulement nom + email ou WhatsApp, un mode de réception (retrait gratuit ou livraison +5€), et un paiement Stripe ou Mobile Money.

**Architecture:** Nouvelle page `checkout.html` remplace le redirect Stripe direct du panier. Route `POST /api/orders?action=guest_checkout` valide, crée la commande en DB, puis selon le mode de paiement: crée une session Stripe ou retourne des instructions Mobile Money. Les colonnes guest sont ajoutées à `orders` et `customers` via migration SQL propre.

**Tech Stack:** Vanilla JS, Supabase PostgreSQL, Vercel Serverless (Node.js), Stripe SDK (existant), HTML/CSS admin existant.

---

## Contraintes critiques

- **Limite 12 fonctions Vercel Hobby** : nouvelle route dans `api/orders.js` via `?action=guest_checkout`
- **Recalcul serveur obligatoire** : prix depuis DB, delivery_fee ajouté côté API
- **user_id n'existe pas** dans orders/customers — architecture "customer" séparée
- **Payment modes** : Stripe (existant), Mobile Money (nouveau, manuel), Cash (nouveau, manuel)
- Stripe webhook existant: ne pas casser

---

## Fichiers concernés

| Fichier | Action | Rôle |
|---------|--------|------|
| `supabase/migrations/013_guest_checkout.sql` | CREATE | Colonnes guest sur orders + whatsapp/notes sur customers |
| `checkout.html` | CREATE | Formulaire checkout invité (HTML) |
| `js/checkout.js` | CREATE | Logique checkout: validation, submit, Stripe/Mobile Money |
| `style.css` | MODIFY | Styles checkout (cards mode paiement/livraison) |
| `api/orders.js` | MODIFY | Route `?action=guest_checkout` — validation + création commande |
| `js/cart-ui.js` | MODIFY | Bouton "Payer" → redirect `checkout.html` sans AccountGuard |
| `success.html` | MODIFY | Affiche confirmation commande invitée + instructions Mobile Money |
| `admin/orders/detail.html` | MODIFY | Affiche champs guest (whatsapp, delivery, payment_status) |
| `admin/js/order-detail.js` | MODIFY | Charge et affiche les nouveaux champs |

---

## Task 1 : Migration SQL

**Files:** Create `supabase/migrations/013_guest_checkout.sql`

- [ ] **Créer le fichier SQL**

```sql
-- supabase/migrations/013_guest_checkout.sql
-- Guest checkout — ajout colonnes sans casser l'existant

-- 1. Colonnes guest sur la table orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_name         TEXT,
  ADD COLUMN IF NOT EXISTS customer_email        TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone        TEXT,
  ADD COLUMN IF NOT EXISTS customer_whatsapp     TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact     TEXT CHECK (preferred_contact IN ('email','whatsapp','phone')),
  ADD COLUMN IF NOT EXISTS delivery_method       TEXT DEFAULT 'pickup'
    CHECK (delivery_method IN ('pickup','home_delivery')),
  ADD COLUMN IF NOT EXISTS delivery_fee          NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_city         TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address      TEXT,
  ADD COLUMN IF NOT EXISTS delivery_notes        TEXT,
  ADD COLUMN IF NOT EXISTS pickup_location       TEXT DEFAULT 'Boutique Alkamar Moroni',
  ADD COLUMN IF NOT EXISTS subtotal_eur          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payment_method        TEXT DEFAULT 'stripe'
    CHECK (payment_method IN ('stripe','mobile_money','cash_pickup','cash_delivery')),
  ADD COLUMN IF NOT EXISTS payment_status        TEXT DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','awaiting_payment','pending_confirmation','paid','failed','refunded')),
  ADD COLUMN IF NOT EXISTS guest_checkout        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_session_id     TEXT,
  ADD COLUMN IF NOT EXISTS mobile_money_ref      TEXT;

-- 2. Colonnes supplémentaires sur customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS whatsapp              TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact     TEXT,
  ADD COLUMN IF NOT EXISTS notes_admin           TEXT,
  ADD COLUMN IF NOT EXISTS user_id               UUID;

-- 3. Étendre les statuts orders pour le nouveau workflow
-- (La contrainte CHECK existante sera remplacée proprement)
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'pending','confirmed','preparing','ready_for_pickup',
      'out_for_delivery','shipped','delivered','completed','cancelled'
    ));

-- 4. Index utiles
CREATE INDEX IF NOT EXISTS idx_orders_guest      ON orders(guest_checkout) WHERE guest_checkout = TRUE;
CREATE INDEX IF NOT EXISTS idx_orders_payment    ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery   ON orders(delivery_method);
```

- [ ] **Appliquer via Supabase Dashboard SQL Editor**
  Copier le contenu ci-dessus, coller dans https://app.supabase.com/project/ovjsinugxkuwsjnfxfgb/sql, Run.

- [ ] **Vérifier**
```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
sb.from('orders').select('guest_checkout, payment_method, delivery_method, customer_whatsapp').limit(1).then(r => {
  console.log(r.error ? 'FAIL: ' + r.error.message : 'OK - guest columns exist');
});
"
```

- [ ] **Commit**
```bash
git add supabase/migrations/013_guest_checkout.sql
git commit -m "feat(checkout): migration SQL guest checkout — colonnes orders + customers"
```

---

## Task 2 : Route API `guest_checkout` dans api/orders.js

**Files:** Modify `api/orders.js`

- [ ] **Ajouter la route** dans `api/orders.js`, juste avant `// GET — liste des commandes` (route publique existante). Chercher ce commentaire et insérer avant.

```javascript
// ─── Route : /api/orders?action=guest_checkout ──────────────────────────────
if (req.query.action === 'guest_checkout') {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });
  // Pas d'auth requise — commande invitée

  const {
    customer_name, customer_email, customer_whatsapp, customer_phone,
    delivery_method = 'pickup', delivery_city, delivery_address, delivery_notes,
    payment_method = 'stripe',
    cart_items,          // [{ id: 'product_uuid', qty: 1 }, ...]
    notes,
  } = req.body || {};

  // ── Validation ────────────────────────────────────────────────────────────
  const errors = [];
  if (!customer_name || customer_name.trim().length < 2)
    errors.push('Nom complet obligatoire (minimum 2 caractères).');
  const emailOk = customer_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email.trim());
  const waRaw   = (customer_whatsapp || '').replace(/\s+/g, '');
  const waOk    = waRaw && /^\+?\d{7,15}$/.test(waRaw);
  if (!emailOk && !waOk)
    errors.push('Indiquez au moins un email valide ou un numéro WhatsApp valide.');
  if (!['pickup','home_delivery'].includes(delivery_method))
    errors.push('Mode de réception invalide.');
  if (!['stripe','mobile_money','cash_pickup','cash_delivery'].includes(payment_method))
    errors.push('Mode de paiement invalide.');
  if (!cart_items || !Array.isArray(cart_items) || cart_items.length === 0)
    errors.push('Le panier est vide.');
  if (errors.length) return res.status(400).json({ errors });

  // ── Recalcul serveur des prix ─────────────────────────────────────────────
  const productIds = cart_items.map(i => i.id).filter(Boolean);
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, price_eur, price_kmf, stock')
    .in('id', productIds)
    .eq('status', 'active');
  if (prodErr) return res.status(500).json({ error: prodErr.message });

  const productMap = {};
  (products || []).forEach(p => { productMap[p.id] = p; });

  let subtotal_eur = 0;
  const validItems = [];
  for (const item of cart_items) {
    const p = productMap[item.id];
    if (!p) return res.status(400).json({ error: `Produit introuvable: ${item.id}` });
    const qty = Math.max(1, parseInt(item.qty) || 1);
    subtotal_eur += p.price_eur * qty;
    validItems.push({ product_id: p.id, product_name: p.name, price_eur: p.price_eur, price_kmf: p.price_kmf, quantity: qty });
  }

  const delivery_fee  = delivery_method === 'home_delivery' ? 5 : 0;
  const total_eur     = parseFloat((subtotal_eur + delivery_fee).toFixed(2));
  const total_kmf     = Math.round(total_eur * 491); // taux EUR/KMF

  // ── Créer ou trouver le customer ──────────────────────────────────────────
  let customer_id = null;
  const lookupEmail = emailOk ? customer_email.trim().toLowerCase() : null;
  if (lookupEmail) {
    const { data: existing } = await supabase.from('customers').select('id')
      .ilike('email', lookupEmail).limit(1).single();
    if (existing) customer_id = existing.id;
  }
  if (!customer_id) {
    const { data: newCust } = await supabase.from('customers').insert({
      name:      customer_name.trim(),
      email:     lookupEmail,
      phone:     customer_phone || null,
      whatsapp:  waOk ? waRaw : null,
    }).select('id').single();
    if (newCust) customer_id = newCust.id;
  }

  // ── Créer la commande ─────────────────────────────────────────────────────
  const { data: order, error: orderErr } = await supabase.from('orders').insert({
    customer_id,
    customer_name:    customer_name.trim(),
    customer_email:   lookupEmail,
    customer_whatsapp: waOk ? waRaw : null,
    customer_phone:   customer_phone || null,
    preferred_contact: emailOk ? 'email' : 'whatsapp',
    delivery_method,
    delivery_fee,
    delivery_city:    delivery_city || null,
    delivery_address: delivery_address || null,
    delivery_notes:   delivery_notes || null,
    pickup_location:  delivery_method === 'pickup' ? 'Boutique Alkamar Moroni' : null,
    subtotal_eur,
    total_eur,
    total_kmf,
    payment_method,
    payment_status:   'unpaid',
    status:           'pending',
    guest_checkout:   true,
    notes:            notes || null,
  }).select().single();
  if (orderErr) return res.status(500).json({ error: orderErr.message });

  // ── Créer les order_items ─────────────────────────────────────────────────
  const items = validItems.map(i => ({ order_id: order.id, ...i }));
  await supabase.from('order_items').insert(items);

  // ── Paiement Stripe ───────────────────────────────────────────────────────
  if (payment_method === 'stripe') {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const lineItems = validItems.map(i => ({
      price_data: {
        currency: 'eur',
        product_data: { name: i.product_name },
        unit_amount: Math.round(i.price_eur * 100),
      },
      quantity: i.quantity,
    }));
    if (delivery_fee > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: { name: 'Livraison à domicile' },
          unit_amount: Math.round(delivery_fee * 100),
        },
        quantity: 1,
      });
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://alkamar-info.vercel.app'}/success.html?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://alkamar-info.vercel.app'}/checkout.html`,
      customer_email: lookupEmail || undefined,
      metadata: { order_id: order.id },
    });
    // Sauvegarder session_id
    await supabase.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id);
    return res.status(200).json({ mode: 'stripe', url: session.url, order_id: order.id });
  }

  // ── Paiement Mobile Money / Cash ──────────────────────────────────────────
  await supabase.from('orders').update({ payment_status: 'awaiting_payment' }).eq('id', order.id);
  return res.status(200).json({
    mode: payment_method,
    order_id: order.id,
    order_number: order.id.split('-')[0].toUpperCase(),
    total_eur,
    payment_instructions: payment_method === 'mobile_money'
      ? { number: '+269 331 27 22', name: 'Alkamar Info', reference: order.id.split('-')[0].toUpperCase() }
      : null,
  });
}
```

- [ ] **Commit**
```bash
git add api/orders.js
git commit -m "feat(checkout): route API guest_checkout — validation + commande DB + Stripe + Mobile Money"
```

---

## Task 3 : checkout.html — Formulaire invité

**Files:** Create `checkout.html`

- [ ] **Créer le fichier**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Commander — Alkamar Info</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="style.css">
  <style>
    /* ── Checkout ─────────────────────────────────── */
    .checkout-wrap { max-width: 540px; margin: 0 auto; padding: 24px 16px 60px; }
    .checkout-title { font-size: 22px; font-weight: 800; margin-bottom: 6px; }
    .checkout-subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }
    .checkout-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    .checkout-section h2 { font-size: 15px; font-weight: 700; margin-bottom: 16px; color: #0f172a; }
    .field { margin-bottom: 14px; }
    .field label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 5px; }
    .field input, .field textarea, .field select {
      width: 100%; padding: 12px 14px; border: 1.5px solid #d1d5db; border-radius: 8px;
      font-size: 15px; font-family: inherit; outline: none; color: #0f172a; background: #fff;
      transition: border-color .15s;
    }
    .field input:focus, .field textarea:focus { border-color: #1a3a8f; box-shadow: 0 0 0 3px rgba(26,58,143,.1); }
    .field .hint { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .field .error { font-size: 12px; color: #dc2626; margin-top: 4px; display: none; }
    .field.has-error input, .field.has-error textarea { border-color: #dc2626; }
    .field.has-error .error { display: block; }
    .contact-or { text-align: center; font-size: 12px; color: #9ca3af; margin: 4px 0; }

    /* Cartes livraison / paiement */
    .option-cards { display: flex; flex-direction: column; gap: 10px; }
    .option-card { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; cursor: pointer; transition: border-color .15s, background .15s; }
    .option-card input[type=radio] { width: 18px; height: 18px; flex-shrink: 0; accent-color: #1a3a8f; margin-top: 2px; cursor: pointer; }
    .option-card.selected { border-color: #1a3a8f; background: #eff6ff; }
    .option-card label { cursor: pointer; flex: 1; }
    .option-card .card-title { font-size: 14px; font-weight: 700; color: #0f172a; }
    .option-card .card-desc { font-size: 12px; color: #6b7280; margin-top: 3px; line-height: 1.4; }
    .option-card .card-price { font-size: 14px; font-weight: 800; color: #1a3a8f; white-space: nowrap; }

    /* Résumé panier */
    .cart-summary { background: #f8fafc; border-radius: 10px; padding: 16px; margin-top: 16px; }
    .cart-summary .line { display: flex; justify-content: space-between; font-size: 13px; color: #374151; padding: 4px 0; }
    .cart-summary .line.total { font-size: 16px; font-weight: 800; color: #0f172a; border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 6px; }

    /* Livraison optionnel */
    #delivery-extra { margin-top: 12px; }

    /* Mobile money */
    .mobile-money-info { background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 14px; font-size: 13px; margin-top: 8px; }
    .mobile-money-info strong { color: #92400e; }

    /* Bouton principal */
    .btn-checkout-submit {
      width: 100%; padding: 16px; background: #f59e0b; color: #111827;
      border: none; border-radius: 10px; font-size: 17px; font-weight: 800;
      cursor: pointer; transition: background .15s; margin-top: 8px;
    }
    .btn-checkout-submit:hover { background: #d97706; }
    .btn-checkout-submit:disabled { opacity: .5; cursor: not-allowed; }

    /* Rassurant */
    .trust-line { text-align: center; font-size: 12px; color: #6b7280; margin-top: 12px; }

    @media (max-width: 400px) { .checkout-wrap { padding: 16px 12px 60px; } }
  </style>
</head>
<body style="background:#f8fafc;min-height:100vh">

  <!-- Header simple -->
  <header style="background:#1a3a8f;padding:14px 20px;position:sticky;top:0;z-index:10">
    <a href="index.html" style="color:#fff;font-weight:800;font-size:17px;text-decoration:none">
      ← Alkamar Info
    </a>
  </header>

  <div class="checkout-wrap">
    <h1 class="checkout-title">Commander</h1>
    <p class="checkout-subtitle">Commandez sans créer de compte. Email ou WhatsApp suffit.</p>

    <!-- ── 1. Coordonnées ──────────────────────────── -->
    <div class="checkout-section">
      <h2>👤 Vos coordonnées</h2>

      <div class="field" id="field-name">
        <label for="name">Nom complet *</label>
        <input type="text" id="name" autocomplete="name" placeholder="Votre nom complet">
        <div class="error" id="err-name">Nom obligatoire (minimum 2 caractères).</div>
      </div>

      <div class="field" id="field-email">
        <label for="email">Email <span style="color:#6b7280;font-weight:400">(optionnel si WhatsApp fourni)</span></label>
        <input type="email" id="email" autocomplete="email" inputmode="email" placeholder="votre@email.com">
        <div class="error" id="err-email">Email invalide.</div>
      </div>

      <div class="contact-or">— ou —</div>

      <div class="field" id="field-whatsapp">
        <label for="whatsapp">Numéro WhatsApp <span style="color:#6b7280;font-weight:400">(optionnel si email fourni)</span></label>
        <input type="tel" id="whatsapp" autocomplete="tel" inputmode="tel" placeholder="+269 xxx xx xx">
        <div class="hint">Format international : +269 321 00 00</div>
        <div class="error" id="err-whatsapp">Numéro WhatsApp invalide.</div>
      </div>

      <div class="error" id="err-contact" style="margin-top:-4px">
        Indiquez au moins un email valide ou un numéro WhatsApp valide.
      </div>
    </div>

    <!-- ── 2. Mode de réception ────────────────────── -->
    <div class="checkout-section">
      <h2>📦 Mode de réception</h2>
      <div class="option-cards">
        <div class="option-card selected" id="card-pickup" onclick="selectDelivery('pickup')">
          <input type="radio" name="delivery" value="pickup" id="radio-pickup" checked>
          <label for="radio-pickup">
            <div class="card-title">🏪 Retrait en boutique à Moroni</div>
            <div class="card-desc">Retirez gratuitement votre commande dans notre boutique à Moroni. Nous vous confirmerons quand elle est prête.</div>
          </label>
          <span class="card-price">Gratuit</span>
        </div>
        <div class="option-card" id="card-home" onclick="selectDelivery('home_delivery')">
          <input type="radio" name="delivery" value="home_delivery" id="radio-home">
          <label for="radio-home">
            <div class="card-title">🚚 Livraison à domicile</div>
            <div class="card-desc">L'adresse exacte pourra être confirmée après la commande par WhatsApp ou email.</div>
          </label>
          <span class="card-price">+5 €</span>
        </div>
      </div>

      <!-- Champs optionnels livraison -->
      <div id="delivery-extra" style="display:none">
        <div style="margin-top:12px;padding:10px 14px;background:#fffbeb;border-radius:8px;font-size:12px;color:#92400e;border:1px solid #fde68a">
          📍 L'adresse exacte pourra être confirmée après la commande par WhatsApp ou email.
        </div>
        <div class="field" style="margin-top:10px">
          <label for="city">Ville <span style="color:#9ca3af">(optionnel)</span></label>
          <input type="text" id="city" placeholder="Ex : Moroni, Iconi, Mitsamiouli…">
        </div>
        <div class="field">
          <label for="address">Indication <span style="color:#9ca3af">(optionnel)</span></label>
          <input type="text" id="address" placeholder="Ex : Près de la mosquée, à côté de l'école…">
        </div>
        <div class="field">
          <label for="delivery-notes">Commentaire <span style="color:#9ca3af">(optionnel)</span></label>
          <textarea id="delivery-notes" rows="2" placeholder="Disponibilité, précision pour le livreur…"></textarea>
        </div>
      </div>
    </div>

    <!-- ── 3. Paiement ─────────────────────────────── -->
    <div class="checkout-section">
      <h2>💳 Mode de paiement</h2>
      <div class="option-cards">
        <div class="option-card selected" id="card-stripe" onclick="selectPayment('stripe')">
          <input type="radio" name="payment" value="stripe" id="radio-stripe" checked>
          <label for="radio-stripe">
            <div class="card-title">💳 Paiement par carte</div>
            <div class="card-desc">Paiement sécurisé par carte bancaire via Stripe.</div>
          </label>
        </div>
        <div class="option-card" id="card-mobile" onclick="selectPayment('mobile_money')">
          <input type="radio" name="payment" value="mobile_money" id="radio-mobile">
          <label for="radio-mobile">
            <div class="card-title">📱 Paiement Mobile Money</div>
            <div class="card-desc">Payez par Mobile Money (M-Pesa, Orange Money, etc.) au numéro indiqué.</div>
          </label>
        </div>
        <div class="option-card" id="card-cash" onclick="selectPayment('cash_pickup')">
          <input type="radio" name="payment" value="cash_pickup" id="radio-cash">
          <label for="radio-cash">
            <div class="card-title">💵 Espèces au retrait / à la livraison</div>
            <div class="card-desc">Payez en espèces lors de la réception de votre commande.</div>
          </label>
        </div>
      </div>

      <div id="mobile-money-info" class="mobile-money-info" style="display:none">
        📱 <strong>Instructions Mobile Money</strong><br>
        Envoyez le montant total au numéro <strong>+269 331 27 22</strong> (Alkamar Info).<br>
        Après envoi, transmettez la preuve par WhatsApp ou email avec votre numéro de commande.
      </div>
    </div>

    <!-- ── Résumé commande ─────────────────────────── -->
    <div class="checkout-section">
      <h2>🛒 Résumé</h2>
      <div id="cart-lines"></div>
      <div class="cart-summary">
        <div class="line"><span>Sous-total</span><span id="subtotal">—</span></div>
        <div class="line" id="delivery-line"><span>Livraison</span><span id="delivery-cost">Gratuit</span></div>
        <div class="line total"><span>Total</span><span id="total">—</span></div>
      </div>
    </div>

    <!-- ── Erreur globale ────────────────────────── -->
    <div id="global-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;font-size:13px;color:#dc2626;margin-bottom:12px"></div>

    <!-- ── Bouton soumettre ────────────────────────── -->
    <button class="btn-checkout-submit" id="btn-submit" onclick="submitCheckout()">
      🛒 Valider ma commande
    </button>
    <p class="trust-line">🔒 Vos informations servent uniquement à préparer votre commande.</p>
    <p class="trust-line">✅ Commande sans compte · Email ou WhatsApp suffit · Retrait gratuit à Moroni</p>
  </div>

  <script src="js/cart.js"></script>
  <script src="js/checkout.js"></script>
</body>
</html>
```

- [ ] **Commit**
```bash
git add checkout.html
git commit -m "feat(checkout): checkout.html — formulaire invité complet"
```

---

## Task 4 : js/checkout.js — Logique frontend

**Files:** Create `js/checkout.js`

- [ ] **Créer le fichier**

```javascript
// js/checkout.js — Logique checkout invité
'use strict';

(function () {
  let _deliveryMethod = 'pickup';
  let _paymentMethod  = 'stripe';
  let _cartItems      = [];

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', () => {
    _cartItems = typeof Cart !== 'undefined' ? Cart.load() : [];
    if (!_cartItems.length) {
      window.location.href = 'index.html';
      return;
    }
    renderCartSummary();
  });

  /* ── Sélection livraison ── */
  window.selectDelivery = function (method) {
    _deliveryMethod = method;
    document.querySelectorAll('.option-card[id^="card-pickup"], .option-card[id^="card-home"]').forEach(c => c.classList.remove('selected'));
    document.getElementById('card-' + (method === 'pickup' ? 'pickup' : 'home'))?.classList.add('selected');
    document.getElementById('radio-' + (method === 'pickup' ? 'pickup' : 'home')).checked = true;
    document.getElementById('delivery-extra').style.display = method === 'home_delivery' ? '' : 'none';
    // Mise à jour du paiement cash selon mode réception
    const cashCard = document.getElementById('card-cash');
    if (cashCard) {
      const cashLabel = cashCard.querySelector('.card-title');
      cashLabel.textContent = method === 'home_delivery'
        ? '💵 Espèces à la livraison'
        : '💵 Espèces au retrait en boutique';
      const cashInput = document.getElementById('radio-cash');
      cashInput.value = method === 'home_delivery' ? 'cash_delivery' : 'cash_pickup';
      if (_paymentMethod.startsWith('cash')) {
        _paymentMethod = cashInput.value;
      }
    }
    renderCartSummary();
  };

  /* ── Sélection paiement ── */
  window.selectPayment = function (method) {
    _paymentMethod = method;
    ['stripe','mobile','cash'].forEach(k => document.getElementById('card-' + k)?.classList.remove('selected'));
    const keyMap = { stripe: 'stripe', mobile_money: 'mobile', cash_pickup: 'cash', cash_delivery: 'cash' };
    document.getElementById('card-' + keyMap[method])?.classList.add('selected');
    const radioMap = { stripe: 'radio-stripe', mobile_money: 'radio-mobile', cash_pickup: 'radio-cash', cash_delivery: 'radio-cash' };
    const radioEl = document.getElementById(radioMap[method]);
    if (radioEl) { radioEl.value = method; radioEl.checked = true; }
    document.getElementById('mobile-money-info').style.display = method === 'mobile_money' ? '' : 'none';
  };

  /* ── Rendu résumé ── */
  function renderCartSummary() {
    const fee     = _deliveryMethod === 'home_delivery' ? 5 : 0;
    const subtotal = _cartItems.reduce((s, i) => s + (i.price_eur || 0) * (i.qty || 1), 0);
    const total   = subtotal + fee;
    const fmt     = n => n.toFixed(2).replace('.', ',') + ' €';

    const lines = document.getElementById('cart-lines');
    if (lines) {
      lines.innerHTML = _cartItems.map(i => {
        const lineTotal = ((i.price_eur || 0) * (i.qty || 1)).toFixed(2).replace('.', ',');
        return `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #f1f5f9">
          <span>${_esc(i.name || '')} ×${i.qty || 1}</span>
          <span style="font-weight:600">${lineTotal} €</span>
        </div>`;
      }).join('');
    }

    _set('subtotal',      fmt(subtotal));
    _set('delivery-cost', fee === 0 ? 'Gratuit' : '+' + fmt(fee));
    _set('total',         fmt(total));
  }

  /* ── Validation ── */
  function validate() {
    let ok = true;

    // Nom
    const name = document.getElementById('name')?.value?.trim() || '';
    setFieldError('field-name', 'err-name', name.length < 2);
    if (name.length < 2) ok = false;

    // Email
    const email = document.getElementById('email')?.value?.trim() || '';
    const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setFieldError('field-email', 'err-email', email && !emailOk);
    if (email && !emailOk) ok = false;

    // WhatsApp
    const wa = (document.getElementById('whatsapp')?.value || '').replace(/\s+/g, '');
    const waOk = !wa || /^\+?\d{7,15}$/.test(wa);
    setFieldError('field-whatsapp', 'err-whatsapp', wa && !waOk);
    if (wa && !waOk) ok = false;

    // Au moins un contact valide
    const contactOk = (email && emailOk) || (wa && waOk);
    const errContact = document.getElementById('err-contact');
    if (errContact) errContact.style.display = contactOk ? 'none' : 'block';
    if (!contactOk) ok = false;

    return ok;
  }

  function setFieldError(fieldId, errId, hasError) {
    const field = document.getElementById(fieldId);
    const err   = document.getElementById(errId);
    if (field) field.classList.toggle('has-error', hasError);
    if (err)   err.style.display = hasError ? 'block' : 'none';
  }

  /* ── Soumission ── */
  window.submitCheckout = async function () {
    if (!validate()) return;

    const btn = document.getElementById('btn-submit');
    const errBox = document.getElementById('global-error');
    btn.disabled = true;
    btn.textContent = '⏳ Traitement en cours…';
    if (errBox) errBox.style.display = 'none';

    const payload = {
      customer_name:       document.getElementById('name').value.trim(),
      customer_email:      document.getElementById('email').value.trim() || null,
      customer_whatsapp:   (document.getElementById('whatsapp').value || '').replace(/\s+/g,'') || null,
      delivery_method:     _deliveryMethod,
      delivery_city:       document.getElementById('city')?.value?.trim() || null,
      delivery_address:    document.getElementById('address')?.value?.trim() || null,
      delivery_notes:      document.getElementById('delivery-notes')?.value?.trim() || null,
      payment_method:      _paymentMethod,
      cart_items:          _cartItems.map(i => ({ id: i.id, qty: i.qty || 1 })),
    };

    try {
      const r = await fetch('/api/orders?action=guest_checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();

      if (!r.ok) {
        const msgs = data.errors ? data.errors.join('<br>') : (data.error || 'Erreur serveur');
        if (errBox) { errBox.innerHTML = msgs; errBox.style.display = ''; }
        btn.disabled = false;
        btn.textContent = '🛒 Valider ma commande';
        return;
      }

      // Vider le panier seulement après succès
      if (typeof Cart !== 'undefined') Cart.clear();

      if (data.mode === 'stripe' && data.url) {
        window.location.href = data.url;
      } else {
        // Mobile Money ou Cash → page succès
        const params = new URLSearchParams({
          order_id:     data.order_id || '',
          order_number: data.order_number || '',
          mode:         data.mode || _paymentMethod,
          total:        data.total_eur || '',
        });
        window.location.href = 'success.html?' + params.toString();
      }
    } catch (e) {
      if (errBox) { errBox.textContent = 'Erreur réseau. Vérifiez votre connexion.'; errBox.style.display = ''; }
      btn.disabled = false;
      btn.textContent = '🛒 Valider ma commande';
    }
  };

  function _set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
})();
```

- [ ] **Commit**
```bash
git add js/checkout.js
git commit -m "feat(checkout): js/checkout.js — validation, sélection livraison/paiement, soumission"
```

---

## Task 5 : cart-ui.js — Rediriger vers checkout.html

**Files:** Modify `js/cart-ui.js`

- [ ] **Remplacer la fonction `checkout()`** (chercher `async function checkout()` ou `checkout()` avec `AccountGuard.requireAuth`)

Trouver le bloc :
```javascript
async function checkout() {
  const items = typeof Cart !== 'undefined' ? Cart.load() : [];
  if (!items.length) return;

  // Gate auth — redirige vers connexion si non connecté
  if (typeof AccountGuard !== 'undefined') {
    let proceed = false;
    await AccountGuard.requireAuth(() => { proceed = true; });
    if (!proceed) return;
  }
  await _doCheckout(items);
}
```

Remplacer par :
```javascript
async function checkout() {
  const items = typeof Cart !== 'undefined' ? Cart.load() : [];
  if (!items.length) return;
  // Redirect vers le checkout invité — aucune auth requise
  window.location.href = '/checkout.html';
}
```

- [ ] **Commit**
```bash
git add js/cart-ui.js
git commit -m "feat(checkout): cart-ui.js redirige vers checkout.html sans bloquer sur auth"
```

---

## Task 6 : success.html — Page de confirmation

**Files:** Modify `success.html`

- [ ] **Lire l'existant** et ajouter la gestion des commandes invitées (Mobile Money / Cash) en plus du flow Stripe existant. Ajouter avant `</body>` :

```html
<script>
// Gestion confirmation commande invitée (Mobile Money / Cash)
(function() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  if (!mode || mode === 'stripe') return; // Stripe géré autrement

  const orderId = params.get('order_id') || '';
  const orderNum = params.get('order_number') || orderId.split('-')[0]?.toUpperCase() || '';
  const totalEur = params.get('total') || '';

  // Créer une section de confirmation pour Mobile Money / Cash
  const section = document.createElement('div');
  section.style.cssText = 'max-width:500px;margin:40px auto;padding:0 16px';
  section.innerHTML = `
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">✅</div>
      <h1 style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:8px">Commande enregistrée !</h1>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px">
        Votre commande a été enregistrée. Nous vous contacterons pour confirmation.
      </p>
      <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:left;font-size:14px">
        <div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#6b7280">N° de commande</span><strong>#${orderNum}</strong></div>
        ${totalEur ? `<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#6b7280">Total</span><strong>${parseFloat(totalEur).toFixed(2).replace('.',',')} €</strong></div>` : ''}
      </div>
      ${mode === 'mobile_money' ? `
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-top:16px;text-align:left;font-size:13px">
        <strong style="color:#92400e">📱 Instructions de paiement Mobile Money</strong><br><br>
        Envoyez <strong>${totalEur ? parseFloat(totalEur).toFixed(2).replace('.',',') + ' €' : 'le montant total'}</strong> au numéro :<br>
        <strong style="font-size:16px">+269 331 27 22</strong> — Alkamar Info<br><br>
        Référence : <strong>#${orderNum}</strong><br><br>
        Après envoi, transmettez la preuve par WhatsApp ou email avec votre numéro de commande.
      </div>` : ''}
      ${mode === 'cash_pickup' ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;margin-top:16px;font-size:13px">🏪 Retrait gratuit dans notre boutique à Moroni. Nous vous confirmerons quand votre commande est prête.</div>` : ''}
      ${mode === 'cash_delivery' ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;margin-top:16px;font-size:13px">🚚 Livraison à domicile — paiement en espèces à la réception. L'adresse exacte sera confirmée après la commande.</div>` : ''}
      <a href="index.html" style="display:block;margin-top:20px;padding:13px;background:#1a3a8f;color:#fff;border-radius:10px;font-weight:700;text-decoration:none;font-size:15px">
        ← Retourner à la boutique
      </a>
    </div>
  `;
  document.body.appendChild(section);
  // Masquer le contenu Stripe si présent
  const stripeSection = document.querySelector('main, .success-main, #success-content');
  if (stripeSection && !window.location.search.includes('session_id')) {
    stripeSection.style.display = 'none';
  }
})();
</script>
```

- [ ] **Commit**
```bash
git add success.html
git commit -m "feat(checkout): success.html — page confirmation Mobile Money / Cash"
```

---

## Task 7 : Admin orders — Afficher champs guest

**Files:** Modify `admin/js/order-detail.js`

- [ ] **Chercher le rendu des infos client** dans order-detail.js et ajouter l'affichage des nouvelles colonnes guest. Chercher `customer_id` ou `customer` et ajouter après l'affichage du client :

```javascript
// Dans la fonction qui affiche les détails de commande, ajouter :
const deliveryLabels = { pickup: '🏪 Retrait boutique — Gratuit', home_delivery: '🚚 Livraison à domicile — 5 €' };
const paymentLabels  = { stripe: '💳 Carte Stripe', mobile_money: '📱 Mobile Money', cash_pickup: '💵 Espèces au retrait', cash_delivery: '💵 Espèces à la livraison' };
const payStatusLabels = { unpaid: '🔴 Non payé', awaiting_payment: '🟡 En attente de paiement', pending_confirmation: '🟡 Confirmation en attente', paid: '🟢 Payé', failed: '🔴 Échec', refunded: '↩ Remboursé' };

// Bloc guest info à insérer dans le rendu :
const guestBlock = order.guest_checkout ? `
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:13px">
    <strong>🛒 Commande sans compte</strong><br>
    <span style="color:#92400e">Nom :</span> ${order.customer_name || '—'}<br>
    ${order.customer_email ? `<span style="color:#92400e">Email :</span> <a href="mailto:${order.customer_email}">${order.customer_email}</a><br>` : ''}
    ${order.customer_whatsapp ? `<span style="color:#92400e">WhatsApp :</span> <a href="https://wa.me/${order.customer_whatsapp.replace(/\D/g,'')}" target="_blank">${order.customer_whatsapp}</a><br>` : ''}
    ${order.delivery_method ? `<span style="color:#92400e">Réception :</span> ${deliveryLabels[order.delivery_method] || order.delivery_method}<br>` : ''}
    ${order.delivery_city ? `<span style="color:#92400e">Ville :</span> ${order.delivery_city}<br>` : ''}
    ${order.delivery_address ? `<span style="color:#92400e">Adresse :</span> ${order.delivery_address}<br>` : ''}
    ${order.payment_method ? `<span style="color:#92400e">Paiement :</span> ${paymentLabels[order.payment_method] || order.payment_method}<br>` : ''}
    ${order.payment_status ? `<span style="color:#92400e">Statut paiement :</span> ${payStatusLabels[order.payment_status] || order.payment_status}` : ''}
  </div>` : '';
```

- [ ] **Commit**
```bash
git add admin/js/order-detail.js
git commit -m "feat(checkout): admin affiche champs guest — whatsapp, livraison, paiement"
```

---

## Task 8 : Deploy + migration + tests manuels

- [ ] **Appliquer la migration 013** dans Supabase Dashboard SQL Editor

- [ ] **Vérifier migration**
```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
Promise.all([
  sb.from('orders').select('guest_checkout,payment_method,delivery_method,customer_whatsapp').limit(1),
  sb.from('customers').select('whatsapp').limit(1),
]).then(([r1, r2]) => {
  console.log('orders guest cols:', r1.error ? 'FAIL ' + r1.error.message : 'OK');
  console.log('customers whatsapp:', r2.error ? 'FAIL ' + r2.error.message : 'OK');
});
"
```

- [ ] **Deploy prod**
```bash
git push && vercel --prod
```

- [ ] **Test 1 — Retrait boutique + email** :
  1. Ajouter produit au panier sur le site
  2. Cliquer "Payer maintenant" → doit rediriger vers `/checkout.html`
  3. Remplir nom + email valide
  4. Laisser WhatsApp vide
  5. Sélectionner "Retrait en boutique"
  6. Vérifier que total = sous-total (0€ livraison)
  7. Choisir "Paiement Mobile Money"
  8. Cliquer "Valider ma commande"
  9. Vérifier page succès avec instructions Mobile Money
  10. Vérifier commande dans admin avec `guest_checkout = true`

- [ ] **Test 2 — WhatsApp uniquement** :
  1. Ajouter produit
  2. Remplir nom + WhatsApp (+269...)
  3. Laisser email vide
  4. Choisir "Livraison à domicile"
  5. Vérifier que +5€ s'affiche
  6. Valider sans adresse
  7. Vérifier commande créée en DB avec `delivery_fee = 5`

- [ ] **Test 3 — Erreur contact vide** :
  1. Laisser email ET WhatsApp vides
  2. Cliquer valider
  3. Vérifier message "Indiquez au moins un email valide ou un numéro WhatsApp valide."
  4. Vérifier qu'aucune commande n'est créée

- [ ] **Commit final**
```bash
git add -A
git commit -m "feat(checkout): Phase 1 complète — checkout invité, Mobile Money, redirection cart"
```

---

## Résumé final

**Fichiers créés/modifiés :**
- `supabase/migrations/013_guest_checkout.sql`
- `checkout.html`
- `js/checkout.js`
- `js/cart-ui.js`
- `success.html`
- `api/orders.js`
- `admin/js/order-detail.js`

**Champs obligatoires checkout :**
- Nom complet (≥ 2 caractères)
- Email valide OU WhatsApp valide (au moins un)
- Mode de réception (pickup ou home_delivery)
- Mode de paiement

**Limites Phase 1 :**
- Pas de page dédiée "créer client depuis commande" (Phase 2)
- Webhook Stripe existant non modifié (fonctionne si `order_id` dans metadata)
- Pas d'email de confirmation automatique
