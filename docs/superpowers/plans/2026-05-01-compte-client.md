# Compte Client E-Commerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un système de compte client complet (inscription/connexion email+OAuth, profil obligatoire, espace commandes) et bloquer le checkout si l'utilisateur n'est pas connecté avec un profil complet.

**Architecture:** Supabase Auth (déjà présent pour admin) est réutilisé pour les clients. Un client JS `@supabase/supabase-js` chargé depuis CDN gère les sessions côté frontend. Une nouvelle table `customer_profiles` stocke les infos obligatoires. Le checkout vérifie la session JWT avant d'appeler Stripe.

**Tech Stack:** Supabase Auth v2 (email+password, Google OAuth, Microsoft OAuth), JavaScript vanilla ES modules, Vercel Serverless Functions, Supabase PostgreSQL, style.css existant.

---

## Prérequis Supabase Dashboard (manuel)

- [ ] **Activer Google OAuth** : Supabase Dashboard → Authentication → Providers → Google → activer, copier Callback URL, créer OAuth app sur https://console.developers.google.com → coller Client ID + Secret dans Supabase.
- [ ] **Activer Microsoft OAuth** : Authentication → Providers → Azure → activer → créer app sur https://portal.azure.com → coller Client ID + Secret.
- [ ] **Activer Email Auth** : Authentication → Providers → Email → activer (normalement déjà actif).
- [ ] **Email templates** : Authentication → Email Templates → configurer l'expéditeur (optionnel).
- [ ] **Site URL** : Authentication → URL Configuration → Site URL = `https://alkamar-info.vercel.app`.
- [ ] **Redirect URLs** : Ajouter `https://alkamar-info.vercel.app/compte.html` et `https://alkamar-info.vercel.app/connexion.html`.

---

## File Map

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `js/auth-client.js` | Créer | Client Supabase JS + helpers auth (getSession, signIn, signOut, OAuth) |
| `js/account-guard.js` | Créer | Guard checkout : vérifie session + profil complet avant Stripe |
| `connexion.html` | Créer | Page login email/password + boutons OAuth |
| `inscription.html` | Créer | Page register email/password + profil |
| `compte.html` | Créer | Espace client : profil + commandes |
| `mot-de-passe-oublie.html` | Créer | Reset password |
| `api/customer-profile.js` | Créer | GET/POST profil client (protégé par JWT Supabase) |
| `js/cart-ui.js` | Modifier | Appel `accountGuard.requireAuth()` avant checkout |
| `style.css` | Modifier | Styles pages auth + espace client |
| `js/nav.js` | Modifier | Bouton "Mon compte" dans header → ouvre compte.html ou connexion.html selon session |
| `.env.local` | Vérifier | SUPABASE_URL + SUPABASE_ANON_KEY déjà présents |

---

## Supabase Migration (à exécuter dans SQL Editor)

```sql
-- Table profil client (liée à auth.users)
CREATE TABLE IF NOT EXISTS customer_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  country       TEXT NOT NULL DEFAULT 'KM',
  city          TEXT NOT NULL,
  address       TEXT NOT NULL,
  postal_code   TEXT,
  terms_accepted_at    TIMESTAMPTZ,
  privacy_accepted_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS : chaque client ne voit que son propre profil
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own profile" ON customer_profiles
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Lier customer_profiles à la table customers existante
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS customers_user_id_idx ON customers(user_id);
```

---

## Task 1 : Client Supabase JS + helpers auth

**Files:**
- Create: `js/auth-client.js`

- [ ] **Créer js/auth-client.js**

```javascript
// js/auth-client.js — Client Supabase Auth côté client
// Charge @supabase/supabase-js depuis CDN dans les pages HTML qui en ont besoin

const SUPABASE_URL  = 'https://ovjsinugxkuwsjnfxfgb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92anNpbnVneGt1d3NqbmZ4ZmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODkxMTMsImV4cCI6MjA5MTU2NTExM30.H45Z2tGvjTaXIpEj-gVpPKLEpNXEDKVZPFJWcoIzj0Y';

// Client Supabase (chargé via <script> CDN avant ce fichier)
let _sb = null;
function getSB() {
  if (_sb) return _sb;
  if (typeof supabase === 'undefined') throw new Error('Supabase CDN non chargé');
  _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return _sb;
}

const AuthClient = {
  // ── Session ───────────────────────────────────────────
  async getSession() {
    const { data } = await getSB().auth.getSession();
    return data.session;
  },

  async getUser() {
    const { data } = await getSB().auth.getUser();
    return data.user;
  },

  // ── Email + Mot de passe ──────────────────────────────
  async signUp(email, password) {
    return getSB().auth.signUp({ email, password,
      options: { emailRedirectTo: window.location.origin + '/connexion.html?verified=1' }
    });
  },

  async signIn(email, password) {
    return getSB().auth.signInWithPassword({ email, password });
  },

  async resetPassword(email) {
    return getSB().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/mot-de-passe-oublie.html?reset=1'
    });
  },

  async updatePassword(newPassword) {
    return getSB().auth.updateUser({ password: newPassword });
  },

  // ── OAuth ─────────────────────────────────────────────
  async signInWithGoogle() {
    return getSB().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/compte.html' }
    });
  },

  async signInWithMicrosoft() {
    return getSB().auth.signInWithOAuth({
      provider: 'azure',
      options: { redirectTo: window.location.origin + '/compte.html' }
    });
  },

  // ── Déconnexion ───────────────────────────────────────
  async signOut() {
    await getSB().auth.signOut();
    window.location.href = '/index.html';
  },

  // ── Profil client ─────────────────────────────────────
  async getProfile() {
    const session = await this.getSession();
    if (!session) return null;
    const res = await fetch('/api/customer-profile', {
      headers: { 'Authorization': 'Bearer ' + session.access_token }
    });
    if (!res.ok) return null;
    return res.json();
  },

  async saveProfile(data) {
    const session = await this.getSession();
    if (!session) throw new Error('Non connecté');
    const res = await fetch('/api/customer-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async isProfileComplete() {
    const p = await this.getProfile();
    if (!p) return false;
    return !!(p.first_name && p.last_name && p.phone && p.city && p.address && p.terms_accepted_at);
  },
};

window.AuthClient = AuthClient;
```

- [ ] **Commit**
```bash
git add js/auth-client.js
git commit -m "feat(auth): client Supabase JS helpers (signIn, signUp, OAuth, profil)"
```

---

## Task 2 : API /api/customer-profile.js

**Files:**
- Create: `api/customer-profile.js`

- [ ] **Créer api/customer-profile.js**

```javascript
// api/customer-profile.js — GET/POST profil client (JWT Supabase)
const { createClient } = require('@supabase/supabase-js');
const { setCors } = require('./_lib/cors');

const sbServer = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function verifyJwt(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  const { data, error } = await sbServer.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyJwt(req);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  if (req.method === 'GET') {
    const { data, error } = await sbServer
      .from('customer_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    return res.status(200).json(data || null);
  }

  if (req.method === 'POST') {
    const { first_name, last_name, phone, country, city, address, postal_code, terms, privacy } = req.body || {};
    if (!first_name || !last_name || !phone || !city || !address) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }
    if (!terms) return res.status(400).json({ error: 'CGV non acceptées' });

    const now = new Date().toISOString();
    const payload = {
      user_id: user.id,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: phone.trim(),
      country: (country || 'KM').trim(),
      city: city.trim(),
      address: address.trim(),
      postal_code: (postal_code || '').trim(),
      terms_accepted_at: now,
      privacy_accepted_at: privacy ? now : null,
      updated_at: now,
    };

    const { data: existing } = await sbServer.from('customer_profiles').select('id').eq('user_id', user.id).single();
    let result;
    if (existing) {
      const { data, error } = await sbServer.from('customer_profiles').update(payload).eq('user_id', user.id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      result = data;
    } else {
      const { data, error } = await sbServer.from('customer_profiles').insert(payload).select().single();
      if (error) return res.status(500).json({ error: error.message });
      result = data;
    }
    return res.status(200).json(result);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
```

- [ ] **Vérifier** que la limite de 12 fonctions Vercel n'est pas dépassée :
```bash
ls api/*.js api/**/*.js 2>/dev/null | grep -v _lib | wc -l
# Doit être ≤ 12
```

- [ ] **Commit**
```bash
git add api/customer-profile.js
git commit -m "feat(auth): api/customer-profile GET/POST sécurisé JWT Supabase"
```

---

## Task 3 : Guard checkout (account-guard.js)

**Files:**
- Create: `js/account-guard.js`
- Modify: `js/cart-ui.js`

- [ ] **Créer js/account-guard.js**

```javascript
// js/account-guard.js — Vérifie auth + profil complet avant checkout
const AccountGuard = {
  async requireAuth(onSuccess) {
    if (typeof AuthClient === 'undefined') { onSuccess(); return; }

    const session = await AuthClient.getSession();
    if (!session) {
      // Sauvegarde l'intention "payer" pour après connexion
      sessionStorage.setItem('checkout_pending', '1');
      window.location.href = '/connexion.html?redirect=checkout';
      return;
    }

    const complete = await AuthClient.isProfileComplete();
    if (!complete) {
      sessionStorage.setItem('checkout_pending', '1');
      window.location.href = '/compte.html?incomplete=1';
      return;
    }

    onSuccess();
  },

  async getAuthHeaders() {
    if (typeof AuthClient === 'undefined') return {};
    const session = await AuthClient.getSession();
    if (!session) return {};
    return { 'Authorization': 'Bearer ' + session.access_token };
  },
};

window.AccountGuard = AccountGuard;
```

- [ ] **Modifier cart-ui.js : remplacer checkout() par version avec gate**

Trouver dans `js/cart-ui.js` la ligne :
```javascript
  async function checkout() {
    const items = typeof Cart !== 'undefined' ? Cart.load() : [];
    if (!items.length) return;
```

Remplacer par :
```javascript
  async function checkout() {
    const items = typeof Cart !== 'undefined' ? Cart.load() : [];
    if (!items.length) return;

    // ── Gate : auth obligatoire ─────────────────────────
    if (typeof AccountGuard !== 'undefined') {
      await AccountGuard.requireAuth(async () => {
        await _doCheckout(items);
      });
      return;
    }
    await _doCheckout(items);
  }

  async function _doCheckout(items) {
```

Et renommer la fin de la fonction `checkout` en `_doCheckout` (jusqu'au `}` fermant), en ajoutant les headers auth :

```javascript
    try {
      const authHeaders = typeof AccountGuard !== 'undefined'
        ? await AccountGuard.getAuthHeaders()
        : {};
      const res = await fetch('/api/orders?action=checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ items }),
        signal: controller.signal,
      });
```

- [ ] **Inclure les scripts dans index.html (et toutes les pages catalogue)**

Ajouter avant `</body>` :
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="js/auth-client.js"></script>
<script src="js/account-guard.js"></script>
```

```bash
# Sed pour toutes les pages produit/catalogue
sed -i 's|<script src="js/cart.js">|<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>\n  <script src="js/auth-client.js"></script>\n  <script src="js/account-guard.js"></script>\n  <script src="js/cart.js">|g' index.html ordinateurs.html composants.html ecrans.html peripheriques.html reseau.html stockage.html protection.html reconditionnes.html promotions.html services.html produit.html imprimantes.html
```

- [ ] **Commit**
```bash
git add js/account-guard.js js/cart-ui.js *.html
git commit -m "feat(auth): gate checkout — auth + profil complet obligatoires"
```

---

## Task 4 : Page connexion.html

**Files:**
- Create: `connexion.html`

- [ ] **Créer connexion.html**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connexion — La Boutique</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="style.css">
  <style>
    .auth-page { min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; background: var(--light); }
    .auth-card { background: #fff; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,.10); padding: 40px 36px; width: 100%; max-width: 420px; }
    .auth-logo { text-align: center; margin-bottom: 28px; }
    .auth-title { font-size: 1.5rem; font-weight: 900; color: #0f172a; margin-bottom: 6px; text-align: center; }
    .auth-sub { font-size: 13px; color: var(--text-muted); text-align: center; margin-bottom: 28px; }
    .auth-field { margin-bottom: 16px; }
    .auth-field label { display: block; font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 6px; }
    .auth-field input { width: 100%; padding: 11px 14px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; transition: border-color .15s; box-sizing: border-box; }
    .auth-field input:focus { border-color: var(--primary); }
    .auth-btn { width: 100%; padding: 13px; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity .15s; }
    .auth-btn--primary { background: var(--primary); color: #fff; }
    .auth-btn--primary:hover { opacity: .9; }
    .auth-btn--google { background: #fff; color: #374151; border: 1.5px solid #e5e7eb; display: flex; align-items: center; justify-content: center; gap: 10px; }
    .auth-btn--microsoft { background: #0078d4; color: #fff; display: flex; align-items: center; justify-content: center; gap: 10px; }
    .auth-divider { text-align: center; margin: 20px 0; font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 12px; }
    .auth-divider::before, .auth-divider::after { content:''; flex:1; height:1px; background:#e5e7eb; }
    .auth-links { text-align: center; margin-top: 20px; font-size: 13px; color: var(--text-muted); }
    .auth-links a { color: var(--primary); font-weight: 600; }
    .auth-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #dc2626; margin-bottom: 16px; display: none; }
    .auth-success { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #059669; margin-bottom: 16px; display: none; }
    .oauth-btns { display: flex; flex-direction: column; gap: 10px; margin-bottom: 4px; }
  </style>
</head>
<body>
  <header class="header" style="position:relative">
    <div class="header__inner">
      <a href="index.html" class="logo"><div class="logo__icon">B</div><span class="logo__text">La <span>Boutique</span></span></a>
    </div>
  </header>

  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">
        <a href="index.html" class="logo" style="justify-content:center"><div class="logo__icon">B</div><span class="logo__text">La <span>Boutique</span></span></a>
      </div>
      <h1 class="auth-title">Connexion</h1>
      <p class="auth-sub">Accédez à votre espace client</p>

      <div id="auth-error" class="auth-error"></div>
      <div id="auth-success" class="auth-success"></div>

      <!-- OAuth -->
      <div class="oauth-btns">
        <button class="auth-btn auth-btn--google" onclick="loginGoogle()">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continuer avec Google
        </button>
        <button class="auth-btn auth-btn--microsoft" onclick="loginMicrosoft()">
          <svg width="18" height="18" viewBox="0 0 23 23"><rect x="1" y="1" width="10" height="10" fill="#f25022"/><rect x="12" y="1" width="10" height="10" fill="#7fba00"/><rect x="1" y="12" width="10" height="10" fill="#00a4ef"/><rect x="12" y="12" width="10" height="10" fill="#ffb900"/></svg>
          Continuer avec Microsoft
        </button>
      </div>

      <div class="auth-divider">ou</div>

      <form id="login-form" onsubmit="loginEmail(event)">
        <div class="auth-field"><label>Email *</label><input type="email" id="email" required placeholder="votre@email.com"></div>
        <div class="auth-field"><label>Mot de passe *</label><input type="password" id="password" required placeholder="••••••••" minlength="8"></div>
        <button type="submit" class="auth-btn auth-btn--primary" id="login-btn">Se connecter</button>
      </form>

      <div class="auth-links">
        <a href="/mot-de-passe-oublie.html">Mot de passe oublié ?</a><br><br>
        Pas encore de compte ? <a href="/inscription.html">Créer un compte</a>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="js/auth-client.js"></script>
  <script>
    // Vérif si déjà connecté
    AuthClient.getSession().then(session => {
      if (session) window.location.href = '/compte.html';
    });

    // Message vérification email
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified')) {
      document.getElementById('auth-success').style.display = 'block';
      document.getElementById('auth-success').textContent = '✅ Email vérifié ! Vous pouvez vous connecter.';
    }

    function showError(msg) {
      const el = document.getElementById('auth-error');
      el.textContent = msg; el.style.display = 'block';
    }
    function hideError() {
      document.getElementById('auth-error').style.display = 'none';
    }

    async function loginEmail(e) {
      e.preventDefault(); hideError();
      const btn = document.getElementById('login-btn');
      btn.disabled = true; btn.textContent = 'Connexion…';
      const { error } = await AuthClient.signIn(
        document.getElementById('email').value,
        document.getElementById('password').value
      );
      if (error) { showError(error.message); btn.disabled = false; btn.textContent = 'Se connecter'; return; }
      const redirect = params.get('redirect');
      if (redirect === 'checkout' || sessionStorage.getItem('checkout_pending')) {
        sessionStorage.removeItem('checkout_pending');
        window.location.href = '/index.html?checkout=1';
      } else {
        window.location.href = '/compte.html';
      }
    }

    async function loginGoogle() { hideError(); await AuthClient.signInWithGoogle(); }
    async function loginMicrosoft() { hideError(); await AuthClient.signInWithMicrosoft(); }
  </script>
</body>
</html>
```

- [ ] **Commit**
```bash
git add connexion.html
git commit -m "feat(auth): page connexion email + Google + Microsoft OAuth"
```

---

## Task 5 : Page inscription.html

**Files:**
- Create: `inscription.html`

- [ ] **Créer inscription.html**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Créer un compte — La Boutique</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="style.css">
  <style>
    /* Mêmes styles que connexion.html */
    .auth-page { min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; background: var(--light); }
    .auth-card { background: #fff; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,.10); padding: 36px; width: 100%; max-width: 480px; }
    .auth-title { font-size: 1.5rem; font-weight: 900; color: #0f172a; margin-bottom: 6px; text-align: center; }
    .auth-sub { font-size: 13px; color: var(--text-muted); text-align: center; margin-bottom: 24px; }
    .auth-field { margin-bottom: 14px; }
    .auth-field label { display: block; font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 5px; }
    .auth-field label .req { color: #ef4444; }
    .auth-field input, .auth-field select { width: 100%; padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; transition: border-color .15s; box-sizing: border-box; }
    .auth-field input:focus, .auth-field select:focus { border-color: var(--primary); }
    .auth-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .auth-btn { width: 100%; padding: 13px; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .auth-btn--primary { background: var(--primary); color: #fff; }
    .auth-btn--primary:hover { opacity: .9; }
    .auth-check { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #374151; margin-bottom: 14px; }
    .auth-check input { width: auto; flex-shrink: 0; margin-top: 2px; accent-color: var(--primary); }
    .auth-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #dc2626; margin-bottom: 14px; display: none; }
    .auth-success { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; font-size: 14px; color: #059669; text-align: center; display: none; }
    .auth-section { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); margin: 20px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
    .auth-links { text-align: center; margin-top: 18px; font-size: 13px; color: var(--text-muted); }
    .auth-links a { color: var(--primary); font-weight: 600; }
    @media (max-width: 480px) { .auth-row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header class="header" style="position:relative">
    <div class="header__inner">
      <a href="index.html" class="logo"><div class="logo__icon">B</div><span class="logo__text">La <span>Boutique</span></span></a>
    </div>
  </header>

  <div class="auth-page">
    <div class="auth-card">
      <h1 class="auth-title">Créer un compte</h1>
      <p class="auth-sub">Rejoignez La Boutique — livraison aux Comores</p>

      <div id="auth-error" class="auth-error"></div>
      <div id="auth-success" class="auth-success">
        📧 Un email de vérification a été envoyé à <strong id="email-sent"></strong>.<br>
        Vérifiez votre boîte mail puis <a href="/connexion.html">connectez-vous</a>.
      </div>

      <form id="register-form" onsubmit="register(event)">
        <div class="auth-section">Informations de connexion</div>
        <div class="auth-field"><label>Email <span class="req">*</span></label><input type="email" id="email" required placeholder="votre@email.com"></div>
        <div class="auth-row">
          <div class="auth-field"><label>Mot de passe <span class="req">*</span></label><input type="password" id="password" required minlength="8" placeholder="Min. 8 caractères"></div>
          <div class="auth-field"><label>Confirmer <span class="req">*</span></label><input type="password" id="password2" required placeholder="Répéter"></div>
        </div>

        <div class="auth-section">Informations de livraison</div>
        <div class="auth-row">
          <div class="auth-field"><label>Prénom <span class="req">*</span></label><input type="text" id="first_name" required placeholder="Mohamed"></div>
          <div class="auth-field"><label>Nom <span class="req">*</span></label><input type="text" id="last_name" required placeholder="Ali"></div>
        </div>
        <div class="auth-field"><label>Téléphone <span class="req">*</span></label><input type="tel" id="phone" required placeholder="+269 33 12 345"></div>
        <div class="auth-row">
          <div class="auth-field"><label>Pays <span class="req">*</span></label>
            <select id="country">
              <option value="KM" selected>Comores 🇰🇲</option>
              <option value="FR">France 🇫🇷</option>
              <option value="RE">Réunion</option>
              <option value="MG">Madagascar</option>
              <option value="DJ">Djibouti</option>
              <option value="MZ">Mozambique</option>
            </select>
          </div>
          <div class="auth-field"><label>Ville <span class="req">*</span></label><input type="text" id="city" required placeholder="Moroni"></div>
        </div>
        <div class="auth-field"><label>Adresse complète <span class="req">*</span></label><input type="text" id="address" required placeholder="Rue, quartier, BP..."></div>
        <div class="auth-field"><label>Code postal <span style="font-size:11px;color:#94a3b8">(optionnel)</span></label><input type="text" id="postal_code" placeholder="Ex: 97600"></div>

        <div class="auth-check">
          <input type="checkbox" id="terms" required>
          <label for="terms">J'accepte les <a href="#" target="_blank">conditions générales de vente</a> <span class="req">*</span></label>
        </div>
        <div class="auth-check">
          <input type="checkbox" id="privacy">
          <label for="privacy">J'accepte la <a href="#" target="_blank">politique de confidentialité</a></label>
        </div>

        <button type="submit" class="auth-btn auth-btn--primary" id="register-btn">Créer mon compte</button>
      </form>

      <div class="auth-links">Déjà un compte ? <a href="/connexion.html">Se connecter</a></div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="js/auth-client.js"></script>
  <script>
    function showError(msg) {
      const el = document.getElementById('auth-error');
      el.textContent = msg; el.style.display = 'block';
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async function register(e) {
      e.preventDefault();
      const btn = document.getElementById('register-btn');
      const email = document.getElementById('email').value.trim();
      const pwd   = document.getElementById('password').value;
      const pwd2  = document.getElementById('password2').value;
      if (pwd !== pwd2) { showError('Les mots de passe ne correspondent pas.'); return; }
      if (!document.getElementById('terms').checked) { showError('Vous devez accepter les CGV.'); return; }

      btn.disabled = true; btn.textContent = 'Création…';
      document.getElementById('auth-error').style.display = 'none';

      // 1. Créer le compte Supabase Auth
      const { data: authData, error: authErr } = await AuthClient.signUp(email, pwd);
      if (authErr) { showError(authErr.message); btn.disabled = false; btn.textContent = 'Créer mon compte'; return; }

      // 2. Si session immédiate (email non vérifié requis désactivé), sauvegarder le profil
      if (authData.session) {
        try {
          await AuthClient.saveProfile({
            first_name: document.getElementById('first_name').value.trim(),
            last_name: document.getElementById('last_name').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            country: document.getElementById('country').value,
            city: document.getElementById('city').value.trim(),
            address: document.getElementById('address').value.trim(),
            postal_code: document.getElementById('postal_code').value.trim(),
            terms: true,
            privacy: document.getElementById('privacy').checked,
          });
          window.location.href = '/compte.html';
          return;
        } catch(err) { console.warn('Profil non sauvegardé:', err.message); }
      }

      // 3. Email de vérification envoyé
      document.getElementById('register-form').style.display = 'none';
      document.getElementById('email-sent').textContent = email;
      document.getElementById('auth-success').style.display = 'block';
    }
  </script>
</body>
</html>
```

- [ ] **Commit**
```bash
git add inscription.html
git commit -m "feat(auth): page inscription avec profil complet + CGV obligatoires"
```

---

## Task 6 : Page compte.html (espace client)

**Files:**
- Create: `compte.html`

- [ ] **Créer compte.html**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mon Compte — La Boutique</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="style.css">
  <style>
    .account-page { max-width: 960px; margin: 32px auto; padding: 0 20px; }
    .account-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; flex-wrap: wrap; gap: 12px; }
    .account-title { font-size: 1.6rem; font-weight: 900; color: #0f172a; }
    .account-tabs { display: flex; gap: 4px; background: #f1f5f9; border-radius: 10px; padding: 4px; margin-bottom: 28px; flex-wrap: wrap; }
    .account-tab { padding: 9px 18px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; background: none; font-family: inherit; color: var(--text-muted); transition: all .15s; }
    .account-tab.active { background: #fff; color: var(--primary); box-shadow: 0 1px 4px rgba(0,0,0,.10); }
    .account-panel { display: none; }
    .account-panel.active { display: block; }
    .profile-card { background: #fff; border-radius: 12px; border: 1px solid var(--border); padding: 28px; }
    .profile-field { margin-bottom: 16px; }
    .profile-field label { display: block; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 5px; text-transform: uppercase; letter-spacing: .04em; }
    .profile-field input, .profile-field select { width: 100%; padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; transition: border-color .15s; box-sizing: border-box; }
    .profile-field input:focus, .profile-field select:focus { border-color: var(--primary); }
    .profile-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .profile-save { display: flex; gap: 12px; align-items: center; margin-top: 20px; flex-wrap: wrap; }
    .order-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; margin-bottom: 12px; }
    .order-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .order-id { font-size: 12px; color: var(--text-muted); }
    .order-date { font-size: 13px; font-weight: 600; color: #0f172a; }
    .order-total { font-size: 16px; font-weight: 900; color: var(--primary); }
    .order-status { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
    .status-pending { background: #fef9c3; color: #92400e; }
    .status-paid { background: #f0fdf4; color: #059669; }
    .status-shipped { background: #eff6ff; color: #1e40af; }
    .btn-sm { padding: 7px 14px; font-size: 12px; font-weight: 700; border-radius: 6px; border: 1px solid var(--border); background: #fff; cursor: pointer; font-family: inherit; color: var(--primary); transition: all .15s; }
    .btn-sm:hover { background: var(--primary); color: #fff; border-color: var(--primary); }
    .alert-incomplete { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 14px 18px; font-size: 14px; color: #92400e; margin-bottom: 20px; }
    @media (max-width: 520px) { .profile-row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header class="header" style="position:relative">
    <div class="header__inner">
      <a href="index.html" class="logo"><div class="logo__icon">B</div><span class="logo__text">La <span>Boutique</span></span></a>
      <div class="header__actions" style="margin-left:auto">
        <span id="user-email" style="font-size:13px;color:#dbeafe;display:none"></span>
        <button onclick="doSignOut()" class="btn-sm" style="margin-left:12px">Déconnexion</button>
      </div>
    </div>
  </header>

  <div class="account-page">
    <div id="incomplete-alert" class="alert-incomplete" style="display:none">
      ⚠️ Votre profil est incomplet. Complétez-le pour pouvoir passer commande.
    </div>

    <div class="account-header">
      <h1 class="account-title">Mon Compte</h1>
    </div>

    <div class="account-tabs">
      <button class="account-tab active" onclick="showTab('profile', this)">👤 Mon Profil</button>
      <button class="account-tab" onclick="showTab('orders', this)">📦 Mes Commandes</button>
    </div>

    <!-- Profil -->
    <div id="panel-profile" class="account-panel active">
      <div class="profile-card">
        <form id="profile-form" onsubmit="saveProfile(event)">
          <div id="profile-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;font-size:13px;color:#dc2626;margin-bottom:16px"></div>
          <div id="profile-success" style="display:none;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;font-size:13px;color:#059669;margin-bottom:16px">✅ Profil sauvegardé</div>
          <div class="profile-row">
            <div class="profile-field"><label>Prénom *</label><input id="p-first" type="text" required></div>
            <div class="profile-field"><label>Nom *</label><input id="p-last" type="text" required></div>
          </div>
          <div class="profile-field"><label>Email</label><input id="p-email" type="email" readonly style="background:#f8fafc;color:#64748b"></div>
          <div class="profile-field"><label>Téléphone *</label><input id="p-phone" type="tel" required></div>
          <div class="profile-row">
            <div class="profile-field"><label>Pays *</label>
              <select id="p-country">
                <option value="KM">Comores 🇰🇲</option>
                <option value="FR">France 🇫🇷</option>
                <option value="RE">Réunion</option>
                <option value="MG">Madagascar</option>
                <option value="DJ">Djibouti</option>
                <option value="MZ">Mozambique</option>
              </select>
            </div>
            <div class="profile-field"><label>Ville *</label><input id="p-city" type="text" required></div>
          </div>
          <div class="profile-field"><label>Adresse *</label><input id="p-address" type="text" required></div>
          <div class="profile-field"><label>Code postal</label><input id="p-postal" type="text"></div>
          <div class="profile-save">
            <button type="submit" class="btn-cart" style="width:auto;padding:11px 28px">💾 Enregistrer</button>
            <span id="save-status" style="font-size:13px;color:#64748b"></span>
          </div>
        </form>
      </div>
    </div>

    <!-- Commandes -->
    <div id="panel-orders" class="account-panel">
      <div id="orders-list"><p style="color:#6b7280;text-align:center;padding:40px">Chargement de vos commandes…</p></div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="js/auth-client.js"></script>
  <script>
    // ── Init ─────────────────────────────────────────────
    (async () => {
      const session = await AuthClient.getSession();
      if (!session) { window.location.href = '/connexion.html'; return; }

      document.getElementById('user-email').textContent = session.user.email;
      document.getElementById('user-email').style.display = 'inline';
      document.getElementById('p-email').value = session.user.email;

      // Charge profil
      const profile = await AuthClient.getProfile();
      if (profile) {
        document.getElementById('p-first').value   = profile.first_name || '';
        document.getElementById('p-last').value    = profile.last_name || '';
        document.getElementById('p-phone').value   = profile.phone || '';
        document.getElementById('p-city').value    = profile.city || '';
        document.getElementById('p-address').value = profile.address || '';
        document.getElementById('p-postal').value  = profile.postal_code || '';
        if (profile.country) document.getElementById('p-country').value = profile.country;
      } else {
        document.getElementById('incomplete-alert').style.display = 'block';
      }

      // Alerte si profil incomplet + redirect checkout
      const params = new URLSearchParams(window.location.search);
      if (params.get('incomplete')) {
        document.getElementById('incomplete-alert').style.display = 'block';
        document.getElementById('incomplete-alert').textContent =
          '⚠️ Complétez votre profil pour finaliser votre commande.';
      }
    })();

    // ── Tabs ─────────────────────────────────────────────
    function showTab(id, btn) {
      document.querySelectorAll('.account-panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.account-tab').forEach(b => b.classList.remove('active'));
      document.getElementById('panel-' + id).classList.add('active');
      btn.classList.add('active');
      if (id === 'orders') loadOrders();
    }

    // ── Sauvegarde profil ─────────────────────────────────
    async function saveProfile(e) {
      e.preventDefault();
      document.getElementById('profile-error').style.display = 'none';
      document.getElementById('profile-success').style.display = 'none';
      document.getElementById('save-status').textContent = 'Sauvegarde…';
      try {
        await AuthClient.saveProfile({
          first_name: document.getElementById('p-first').value.trim(),
          last_name : document.getElementById('p-last').value.trim(),
          phone     : document.getElementById('p-phone').value.trim(),
          country   : document.getElementById('p-country').value,
          city      : document.getElementById('p-city').value.trim(),
          address   : document.getElementById('p-address').value.trim(),
          postal_code: document.getElementById('p-postal').value.trim(),
          terms: true, privacy: true,
        });
        document.getElementById('profile-success').style.display = 'block';
        document.getElementById('incomplete-alert').style.display = 'none';
        document.getElementById('save-status').textContent = '';
        // Si pending checkout → retour panier
        if (sessionStorage.getItem('checkout_pending')) {
          sessionStorage.removeItem('checkout_pending');
          window.location.href = '/index.html?checkout=1';
        }
      } catch(err) {
        const el = document.getElementById('profile-error');
        el.textContent = err.message; el.style.display = 'block';
        document.getElementById('save-status').textContent = '';
      }
    }

    // ── Commandes ─────────────────────────────────────────
    async function loadOrders() {
      const session = await AuthClient.getSession();
      if (!session) return;
      const res = await fetch('/api/orders?my=1', {
        headers: { 'Authorization': 'Bearer ' + session.access_token }
      });
      const orders = await res.json();
      const container = document.getElementById('orders-list');
      if (!Array.isArray(orders) || !orders.length) {
        container.innerHTML = '<p style="color:#6b7280;text-align:center;padding:40px">Vous n\'avez pas encore de commande.</p>';
        return;
      }
      container.innerHTML = orders.map(o => `
        <div class="order-card">
          <div class="order-header">
            <div>
              <div class="order-date">${new Date(o.created_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric'})}</div>
              <div class="order-id">#${o.id.slice(0,8).toUpperCase()}</div>
            </div>
            <div style="text-align:right">
              <div class="order-total">${(o.total_eur||0).toFixed(2).replace('.',',')} €</div>
              <span class="order-status ${o.status==='paid'?'status-paid':o.status==='shipped'?'status-shipped':'status-pending'}">
                ${o.status==='paid'?'✅ Payé':o.status==='shipped'?'🚚 Expédié':'⏳ En attente'}
              </span>
            </div>
          </div>
        </div>`).join('');
    }

    async function doSignOut() { await AuthClient.signOut(); }
  </script>
</body>
</html>
```

- [ ] **Commit**
```bash
git add compte.html
git commit -m "feat(auth): espace client — profil + commandes + déconnexion"
```

---

## Task 7 : Page mot-de-passe-oublie.html

**Files:**
- Create: `mot-de-passe-oublie.html`

- [ ] **Créer mot-de-passe-oublie.html**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mot de passe oublié — La Boutique</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="style.css">
  <style>
    .auth-page{min-height:80vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--light)}
    .auth-card{background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.10);padding:40px 36px;width:100%;max-width:420px}
    .auth-title{font-size:1.4rem;font-weight:900;color:#0f172a;margin-bottom:6px;text-align:center}
    .auth-sub{font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:24px}
    .auth-field{margin-bottom:16px}
    .auth-field label{display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:5px}
    .auth-field input{width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s;box-sizing:border-box}
    .auth-field input:focus{border-color:var(--primary)}
    .auth-btn{width:100%;padding:13px;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;background:var(--primary);color:#fff}
    .auth-links{text-align:center;margin-top:18px;font-size:13px;color:var(--text-muted)}
    .auth-links a{color:var(--primary);font-weight:600}
    .auth-msg{border-radius:8px;padding:12px 14px;font-size:13px;margin-bottom:16px;display:none}
    .auth-msg.ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#059669}
    .auth-msg.err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626}
  </style>
</head>
<body>
  <header class="header" style="position:relative"><div class="header__inner"><a href="index.html" class="logo"><div class="logo__icon">B</div><span class="logo__text">La <span>Boutique</span></span></a></div></header>
  <div class="auth-page"><div class="auth-card">
    <h1 class="auth-title">Mot de passe oublié</h1>
    <p class="auth-sub">Entrez votre email pour recevoir un lien de réinitialisation</p>
    <div id="msg" class="auth-msg"></div>
    <div id="new-pwd-section" style="display:none">
      <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:16px">Nouveau mot de passe</h2>
      <div class="auth-field"><label>Nouveau mot de passe</label><input type="password" id="new-pwd" minlength="8" placeholder="Min. 8 caractères"></div>
      <button class="auth-btn" onclick="updatePwd()">Mettre à jour</button>
    </div>
    <form id="reset-form" onsubmit="sendReset(event)">
      <div class="auth-field"><label>Email</label><input type="email" id="email" required placeholder="votre@email.com"></div>
      <button type="submit" class="auth-btn" id="send-btn">Envoyer le lien</button>
    </form>
    <div class="auth-links"><a href="/connexion.html">← Retour à la connexion</a></div>
  </div></div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="js/auth-client.js"></script>
  <script>
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset')) {
      document.getElementById('reset-form').style.display = 'none';
      document.getElementById('new-pwd-section').style.display = 'block';
    }
    async function sendReset(e) {
      e.preventDefault();
      const btn = document.getElementById('send-btn');
      btn.disabled = true; btn.textContent = 'Envoi…';
      const { error } = await AuthClient.resetPassword(document.getElementById('email').value);
      const el = document.getElementById('msg');
      if (error) { el.className='auth-msg err'; el.textContent = error.message; }
      else { el.className='auth-msg ok'; el.textContent = '✅ Email envoyé ! Vérifiez votre boîte mail.'; document.getElementById('reset-form').style.display='none'; }
      el.style.display='block';
    }
    async function updatePwd() {
      const { error } = await AuthClient.updatePassword(document.getElementById('new-pwd').value);
      const el = document.getElementById('msg');
      if (error) { el.className='auth-msg err'; el.textContent = error.message; }
      else { el.className='auth-msg ok'; el.textContent = '✅ Mot de passe mis à jour !'; setTimeout(()=>window.location.href='/connexion.html',2000); }
      el.style.display='block';
    }
  </script>
</body>
</html>
```

- [ ] **Commit**
```bash
git add mot-de-passe-oublie.html
git commit -m "feat(auth): page reset mot de passe"
```

---

## Task 8 : Mise à jour orders.js — commandes par user

**Files:**
- Modify: `api/orders.js`

- [ ] **Ajouter route `GET /api/orders?my=1`** — retourne les commandes de l'user connecté

Dans `api/orders.js`, dans le bloc `if (req.method === 'GET')`, ajouter AVANT la vérification admin :

```javascript
  if (req.method === 'GET' && req.query.my === '1') {
    // Route publique (JWT Supabase requis) — commandes du client connecté
    const sbAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: userData } = await sbAnon.auth.getUser(token);
    if (!userData?.user) return res.status(401).json({ error: 'Non authentifié' });
    // Cherche customer lié à cet user
    const { data: customer } = await supabase.from('customers').select('id').eq('user_id', userData.user.id).single();
    if (!customer) return res.status(200).json([]);
    const { data, error } = await supabase
      .from('orders')
      .select('id, created_at, total_eur, total_kmf, status, notes')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
```

Il faut aussi importer `createClient` en haut du fichier :
```javascript
const { createClient } = require('@supabase/supabase-js');
```

- [ ] **Lier user_id au customer lors du checkout** — dans `handleStripeCheckout()` ou dans la logique POST de création de commande, récupérer l'user depuis le JWT et mettre à jour `customers.user_id`.

- [ ] **Commit**
```bash
git add api/orders.js
git commit -m "feat(auth): orders GET?my=1 par user + liaison customer.user_id"
```

---

## Task 9 : nav.js — bouton Mon Compte dynamique

**Files:**
- Modify: `js/nav.js`

- [ ] **Mettre à jour le header dans nav.js** — remplacer le lien "Mon compte" statique par un bouton dynamique selon la session :

Dans `NAV_HTML` et `QUICK_CATS_HTML`, le lien `Mon compte` dans la topbar devient :
```html
<a id="nav-account-link" href="/connexion.html">Mon compte</a>
```

Ajouter à la fin de `initMobileMenu()` et `setActiveQuickCat()` :
```javascript
  /* ── Mise à jour dynamique lien Mon compte ── */
  (async () => {
    try {
      if (typeof supabase === 'undefined') return;
      const sb = supabase.createClient(
        'https://ovjsinugxkuwsjnfxfgb.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92anNpbnVneGt1d3NqbmZ4ZmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODkxMTMsImV4cCI6MjA5MTU2NTExM30.H45Z2tGvjTaXIpEj-gVpPKLEpNXEDKVZPFJWcoIzj0Y'
      );
      const { data } = await sb.auth.getSession();
      const links = document.querySelectorAll('#nav-account-link, .topbar__links a[href*="booking"]');
      links.forEach(l => {
        if (data.session) { l.href = '/compte.html'; l.textContent = '👤 Mon compte'; }
        else { l.href = '/connexion.html'; l.textContent = 'Connexion'; }
      });
    } catch {}
  })();
```

- [ ] **Commit**
```bash
git add js/nav.js
git commit -m "feat(auth): lien Mon Compte dynamique selon session Supabase"
```

---

## Task 10 : Deploy + variables Vercel

- [ ] **Vérifier que SUPABASE_ANON_KEY est dans Vercel**
```bash
vercel env ls | grep -i supabase
# Doit afficher SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

- [ ] **Final commit + deploy**
```bash
git add -A
git commit -m "feat(auth): système compte client complet — auth, profil, espace client, gate checkout"
vercel --prod
```

- [ ] **Test E2E avec Playwright**
```javascript
// Tester dans scripts/test-auth.js :
// 1. Aller sur index.html → cliquer Ajouter → cliquer Payer → redirect connexion.html ✅
// 2. S'inscrire avec test@alkamar.test + mdp → profil complet → payer → Stripe ✅
// 3. Déconnexion → panier vide → reconnexion → panier conservé ✅
```

---

## Self-Review

**Spec coverage :**
- ✅ Création compte email+password
- ✅ Connexion email+password
- ✅ Google OAuth
- ✅ Microsoft OAuth
- ⚠️ Yahoo OAuth — non supporté nativement par Supabase (prévu via email/password fallback)
- ✅ Mot de passe oublié
- ✅ Vérification email (configurable dans Supabase)
- ✅ Champs obligatoires (prénom, nom, téléphone, ville, adresse, CGV)
- ✅ Code postal optionnel
- ✅ Espace client profil + commandes
- ✅ Blocage checkout si non connecté
- ✅ Blocage checkout si profil incomplet
- ✅ Commandes liées au compte
- ✅ Déconnexion
- ✅ Responsive (CSS existant)
- ✅ Sécurité (JWT, RLS Supabase, pas de clé secrète frontend)

**Gaps :**
- Yahoo OAuth : non supporté par Supabase sans config custom. Le formulaire email/password est le fallback.
- Factures PDF : hors scope (sera ajouté séparément si nécessaire).
