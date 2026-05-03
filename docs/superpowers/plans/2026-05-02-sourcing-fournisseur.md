# Sourcing Fournisseur Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une section "Sourcing fournisseur" dans l'admin Alkamar permettant de stocker le lien d'achat principal, afficher un bouton "Acheter", et comparer des offres fournisseurs — sans jamais exposer ces données côté client.

**Architecture:** Migration SQL Supabase pour les colonnes supplier_* sur products + table product_supplier_offers. API Vercel `/api/suppliers/*`. Section HTML + JS dans admin/products/edit.html isolée côté admin uniquement.

**Tech Stack:** Vanilla JS, Supabase (PostgreSQL), Vercel Serverless Functions, HTML/CSS admin existant.

---

## Fichiers concernés

| Fichier | Action | Rôle |
|---------|--------|------|
| `supabase/migrations/010_supplier_sourcing.sql` | CREATE | Migration: colonnes supplier_* + table product_supplier_offers |
| `api/suppliers/offers.js` | CREATE | CRUD offres fournisseurs (GET/POST/PUT/DELETE) |
| `api/suppliers/search.js` | CREATE | Recherche intelligente fournisseurs (Phase 2) |
| `admin/products/edit.html` | MODIFY | Ajouter section "Sourcing fournisseur" après section Badge |
| `admin/js/sourcing.js` | CREATE | Logique JS sourcing (load, save, open link, search) |
| `admin/css/admin.css` | MODIFY | Styles section sourcing |

---

## PHASE 1 — Données + Bouton Acheter + Section Admin

### Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/010_supplier_sourcing.sql`

- [ ] **Créer la migration SQL**

```sql
-- supabase/migrations/010_supplier_sourcing.sql

-- 1. Colonnes supplier sur la table products (fournisseur principal)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_url          TEXT,
  ADD COLUMN IF NOT EXISTS supplier_name         TEXT,
  ADD COLUMN IF NOT EXISTS supplier_price        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS supplier_currency     TEXT DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS supplier_shipping     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS supplier_delivery     TEXT,
  ADD COLUMN IF NOT EXISTS supplier_availability TEXT DEFAULT 'unknown'
    CHECK (supplier_availability IN ('in_stock','out_of_stock','unknown')),
  ADD COLUMN IF NOT EXISTS supplier_last_checked TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supplier_notes        TEXT;

-- 2. Table des offres fournisseurs comparées
CREATE TABLE IF NOT EXISTS product_supplier_offers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_name    TEXT NOT NULL,
  supplier_url     TEXT NOT NULL,
  title            TEXT,
  price            NUMERIC(10,2),
  currency         TEXT DEFAULT 'EUR',
  shipping_price   NUMERIC(10,2),
  delivery_estimate TEXT,
  availability     TEXT DEFAULT 'unknown'
    CHECK (availability IN ('in_stock','out_of_stock','unknown')),
  score            NUMERIC(5,2),
  source           TEXT,
  country          TEXT DEFAULT 'FR',
  confidence       SMALLINT DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  is_primary       BOOLEAN DEFAULT FALSE,
  last_checked_at  TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_supplier_offers_product ON product_supplier_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_offers_score ON product_supplier_offers(product_id, score DESC);

-- RLS : lecture interdite côté anon (admin seulement via service_role)
ALTER TABLE product_supplier_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_supplier_offers"
  ON product_supplier_offers
  USING (auth.role() = 'authenticated');
```

- [ ] **Appliquer la migration via Supabase CLI ou interface**

```bash
# Option A: via Supabase CLI
supabase db push

# Option B: copier-coller dans Supabase Dashboard > SQL Editor
```

- [ ] **Commit**

```bash
git add supabase/migrations/010_supplier_sourcing.sql
git commit -m "feat(sourcing): migration SQL colonnes supplier + table product_supplier_offers"
```

---

### Task 2: API `/api/suppliers/offers.js`

**Files:**
- Create: `api/suppliers/offers.js`

- [ ] **Créer l'API CRUD**

```javascript
// api/suppliers/offers.js
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireRole(req, 'admin', 'editor');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { product_id, offer_id } = req.query;

  // GET — liste des offres pour un produit
  if (req.method === 'GET') {
    if (!product_id) return res.status(400).json({ error: 'product_id requis' });
    const { data, error } = await supabase
      .from('product_supplier_offers')
      .select('*')
      .eq('product_id', product_id)
      .order('score', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST — créer une offre
  if (req.method === 'POST') {
    const { data, error } = await supabase
      .from('product_supplier_offers')
      .insert({ ...req.body, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  // PUT — modifier une offre
  if (req.method === 'PUT') {
    if (!offer_id) return res.status(400).json({ error: 'offer_id requis' });
    const { data, error } = await supabase
      .from('product_supplier_offers')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', offer_id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // DELETE — supprimer une offre
  if (req.method === 'DELETE') {
    if (!offer_id) return res.status(400).json({ error: 'offer_id requis' });
    const { error } = await supabase
      .from('product_supplier_offers')
      .delete()
      .eq('id', offer_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  // PATCH — définir une offre comme principale (copie vers product)
  if (req.method === 'PATCH') {
    if (!offer_id || !product_id) return res.status(400).json({ error: 'offer_id et product_id requis' });

    // Récupère l'offre
    const { data: offer, error: offerErr } = await supabase
      .from('product_supplier_offers')
      .select('*')
      .eq('id', offer_id)
      .single();
    if (offerErr) return res.status(404).json({ error: 'Offre introuvable' });

    // Met à jour le produit avec les infos de l'offre principale
    const { error: prodErr } = await supabase
      .from('products')
      .update({
        supplier_url:          offer.supplier_url,
        supplier_name:         offer.supplier_name,
        supplier_price:        offer.price,
        supplier_currency:     offer.currency,
        supplier_shipping:     offer.shipping_price,
        supplier_delivery:     offer.delivery_estimate,
        supplier_availability: offer.availability,
        supplier_last_checked: new Date().toISOString(),
        updated_at:            new Date().toISOString(),
      })
      .eq('id', product_id);
    if (prodErr) return res.status(500).json({ error: prodErr.message });

    // Marque cette offre comme principale
    await supabase.from('product_supplier_offers')
      .update({ is_primary: false })
      .eq('product_id', product_id);
    await supabase.from('product_supplier_offers')
      .update({ is_primary: true })
      .eq('id', offer_id);

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Méthode non supportée' });
};
```

- [ ] **Commit**

```bash
git add api/suppliers/offers.js
git commit -m "feat(sourcing): API CRUD /api/suppliers/offers"
```

---

### Task 3: Section HTML dans admin/products/edit.html

**Files:**
- Modify: `admin/products/edit.html` (après section badge, avant fermeture du formulaire principal)

- [ ] **Trouver l'emplacement** — cherche `<!-- Badge -->` ou `badge` dans le HTML et insert la section après

- [ ] **Ajouter la section HTML** après la section badge existante :

```html
<!-- ══ SOURCING FOURNISSEUR (admin uniquement) ════════════════════════ -->
<div class="form-section" id="section-sourcing">
  <div class="form-section__header">
    <h3 class="form-section__title">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
      </svg>
      Sourcing fournisseur
    </h3>
    <span class="badge-admin-only" title="Jamais visible côté client">Admin seulement</span>
  </div>

  <!-- Fournisseur principal -->
  <div class="sourcing-primary" id="sourcing-primary">
    <div class="sourcing-primary__grid">
      <div class="form-group">
        <label class="form-label">Lien fournisseur principal</label>
        <div class="sourcing-url-row">
          <input type="url" id="supplier_url" class="form-input" placeholder="https://www.amazon.fr/dp/...">
          <button type="button" class="btn btn--primary btn--sm" id="btn-acheter" onclick="sourcingBuyNow()" disabled>
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            Acheter
          </button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Fournisseur</label>
        <input type="text" id="supplier_name" class="form-input" placeholder="Amazon, Cdiscount, LDLC…">
      </div>

      <div class="form-group form-group--half">
        <label class="form-label">Prix fournisseur</label>
        <div class="input-with-suffix">
          <input type="number" id="supplier_price" class="form-input" placeholder="0.00" step="0.01" min="0">
          <span class="input-suffix">€</span>
        </div>
      </div>

      <div class="form-group form-group--half">
        <label class="form-label">Frais de livraison</label>
        <div class="input-with-suffix">
          <input type="number" id="supplier_shipping" class="form-input" placeholder="0.00" step="0.01" min="0">
          <span class="input-suffix">€</span>
        </div>
      </div>

      <div class="form-group form-group--half">
        <label class="form-label">Délai de livraison</label>
        <input type="text" id="supplier_delivery" class="form-input" placeholder="2-3 jours, J+1…">
      </div>

      <div class="form-group form-group--half">
        <label class="form-label">Disponibilité</label>
        <select id="supplier_availability" class="form-select">
          <option value="unknown">Inconnu</option>
          <option value="in_stock">En stock</option>
          <option value="out_of_stock">Rupture</option>
        </select>
      </div>
    </div>

    <div class="sourcing-notes-row">
      <div class="form-group">
        <label class="form-label">Notes fournisseur</label>
        <textarea id="supplier_notes" class="form-input" rows="2" placeholder="Conditions, contact, notes internes…"></textarea>
      </div>
    </div>

    <div class="sourcing-meta" id="sourcing-meta" style="display:none">
      <span id="sourcing-last-checked"></span>
    </div>
  </div>

  <!-- Actions sourcing -->
  <div class="sourcing-actions">
    <button type="button" class="btn btn--secondary btn--sm" id="btn-search-price" onclick="sourcingSearch()">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      Chercher meilleur prix
    </button>
    <button type="button" class="btn btn--ghost btn--sm" id="btn-show-offers" onclick="sourcingToggleOffers()">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
      Voir les offres (<span id="offers-count">0</span>)
    </button>
  </div>

  <!-- Status message -->
  <div id="sourcing-status" class="sourcing-status" style="display:none"></div>

  <!-- Tableau comparaison offres -->
  <div id="sourcing-offers-panel" style="display:none">
    <div class="sourcing-offers-header">
      <h4>Offres comparées</h4>
      <button type="button" class="btn btn--ghost btn--xs" onclick="sourcingAddOffer()">+ Ajouter manuellement</button>
    </div>
    <div class="table-responsive">
      <table class="sourcing-table" id="sourcing-table">
        <thead>
          <tr>
            <th>Fournisseur</th>
            <th>Titre</th>
            <th>Prix</th>
            <th>Livraison</th>
            <th>Délai</th>
            <th>Dispo</th>
            <th>Score</th>
            <th>Confiance</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="sourcing-offers-body">
          <tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:20px">Aucune offre enregistrée</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal ajout manuel -->
  <div id="sourcing-add-modal" class="modal" style="display:none">
    <div class="modal__overlay" onclick="sourcingCloseModal()"></div>
    <div class="modal__content" style="max-width:520px">
      <div class="modal__header">
        <h3>Ajouter une offre fournisseur</h3>
        <button class="modal__close" onclick="sourcingCloseModal()">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-group"><label>Fournisseur *</label><input type="text" id="modal-supplier-name" class="form-input" placeholder="Amazon, Cdiscount…"></div>
        <div class="form-group"><label>URL *</label><input type="url" id="modal-supplier-url" class="form-input" placeholder="https://…"></div>
        <div class="form-group"><label>Titre produit trouvé</label><input type="text" id="modal-title" class="form-input"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label>Prix (€)</label><input type="number" id="modal-price" class="form-input" step="0.01"></div>
          <div class="form-group"><label>Livraison (€)</label><input type="number" id="modal-shipping" class="form-input" step="0.01"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label>Délai</label><input type="text" id="modal-delivery" class="form-input" placeholder="2-3 jours"></div>
          <div class="form-group"><label>Disponibilité</label>
            <select id="modal-availability" class="form-select">
              <option value="unknown">Inconnu</option>
              <option value="in_stock">En stock</option>
              <option value="out_of_stock">Rupture</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label>Confiance produit (0-100)</label><input type="number" id="modal-confidence" class="form-input" min="0" max="100" value="80"></div>
      </div>
      <div class="modal__footer">
        <button type="button" class="btn btn--ghost" onclick="sourcingCloseModal()">Annuler</button>
        <button type="button" class="btn btn--primary" onclick="sourcingSaveOffer()">Enregistrer l'offre</button>
      </div>
    </div>
  </div>
</div>
<!-- ══ FIN SOURCING ═════════════════════════════════════════════════ -->
```

- [ ] **Ajouter le script sourcing.js** à la fin du fichier HTML (avant `</body>`) :

```html
<script src="../js/sourcing.js"></script>
```

- [ ] **Commit**

```bash
git add admin/products/edit.html
git commit -m "feat(sourcing): section HTML sourcing fournisseur dans fiche produit admin"
```

---

### Task 4: Logique JS `admin/js/sourcing.js`

**Files:**
- Create: `admin/js/sourcing.js`

- [ ] **Créer le fichier JS**

```javascript
// admin/js/sourcing.js — Logique sourcing fournisseur (admin uniquement)
'use strict';

(function () {

  /* ── État ────────────────────────────────────────────────────── */
  let _productId = null;
  let _offers    = [];
  let _editOfferId = null;

  /* ── Init : appelée par product-edit.js après chargement produit ── */
  window.sourcingInit = function (productId, productData) {
    _productId = productId;

    // Remplir les champs fournisseur principal
    const fields = ['supplier_url','supplier_name','supplier_price',
                    'supplier_shipping','supplier_delivery',
                    'supplier_availability','supplier_notes'];
    fields.forEach(f => {
      const el = document.getElementById(f);
      if (el && productData[f] != null) el.value = productData[f];
    });

    // Activer bouton Acheter si URL présente
    _updateBuyButton();

    // Afficher date dernière vérif
    if (productData.supplier_last_checked) {
      const meta = document.getElementById('sourcing-meta');
      const ts = document.getElementById('sourcing-last-checked');
      if (meta && ts) {
        const d = new Date(productData.supplier_last_checked);
        ts.textContent = 'Dernière vérif : ' + d.toLocaleString('fr-FR');
        meta.style.display = '';
      }
    }

    // Écouter changement URL
    document.getElementById('supplier_url')?.addEventListener('input', _updateBuyButton);

    // Charger les offres
    if (productId) _loadOffers();
  };

  function _updateBuyButton() {
    const url = document.getElementById('supplier_url')?.value?.trim();
    const btn = document.getElementById('btn-acheter');
    if (btn) btn.disabled = !url;
  }

  /* ── Collecte les données sourcing pour le save global du produit ── */
  window.sourcingCollectData = function () {
    return {
      supplier_url:          document.getElementById('supplier_url')?.value?.trim() || null,
      supplier_name:         document.getElementById('supplier_name')?.value?.trim() || null,
      supplier_price:        parseFloat(document.getElementById('supplier_price')?.value) || null,
      supplier_shipping:     parseFloat(document.getElementById('supplier_shipping')?.value) || null,
      supplier_delivery:     document.getElementById('supplier_delivery')?.value?.trim() || null,
      supplier_availability: document.getElementById('supplier_availability')?.value || 'unknown',
      supplier_notes:        document.getElementById('supplier_notes')?.value?.trim() || null,
    };
  };

  /* ── Bouton Acheter ── */
  window.sourcingBuyNow = function () {
    const url = document.getElementById('supplier_url')?.value?.trim();
    if (url) window.open(url, '_blank', 'noopener');
  };

  /* ── Charger les offres ── */
  async function _loadOffers() {
    if (!_productId) return;
    try {
      const data = await api.get(`/api/suppliers/offers?product_id=${_productId}`);
      _offers = Array.isArray(data) ? data : [];
      _renderOffers();
      document.getElementById('offers-count').textContent = _offers.length;
    } catch (e) {
      console.warn('[Sourcing] Chargement offres échoué:', e.message);
    }
  }

  /* ── Afficher tableau offres ── */
  function _renderOffers() {
    const tbody = document.getElementById('sourcing-offers-body');
    if (!tbody) return;

    if (!_offers.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:20px">Aucune offre enregistrée</td></tr>`;
      return;
    }

    tbody.innerHTML = _offers.map(o => {
      const total = (Number(o.price)||0) + (Number(o.shipping_price)||0);
      const avail = { in_stock:'🟢 En stock', out_of_stock:'🔴 Rupture', unknown:'⚪ Inconnu' }[o.availability] || '⚪';
      const score = o.score ? `<span class="score-badge score-${o.score >= 80 ? 'high' : o.score >= 60 ? 'med' : 'low'}">${Math.round(o.score)}</span>` : '—';
      const conf  = o.confidence ? `<span class="conf-badge">${o.confidence}%</span>` : '—';
      const primary = o.is_primary ? '<span class="badge badge--best" style="font-size:10px">Principal</span>' : '';

      return `<tr class="${o.is_primary ? 'sourcing-row--primary' : ''}">
        <td><strong>${_esc(o.supplier_name)}</strong>${primary}</td>
        <td class="sourcing-title" title="${_esc(o.title||'')}">${_esc((o.title||'').substring(0,40))}${(o.title||'').length>40?'…':''}</td>
        <td>${o.price ? o.price.toFixed(2)+'€' : '—'}</td>
        <td>${o.shipping_price ? o.shipping_price.toFixed(2)+'€' : 'Gratuit'}</td>
        <td>${_esc(o.delivery_estimate||'—')}</td>
        <td>${avail}</td>
        <td>${score}</td>
        <td>${conf}</td>
        <td class="sourcing-actions-cell">
          <button class="btn btn--ghost btn--xs" onclick="window.open('${_esc(o.supplier_url)}','_blank','noopener')" title="Ouvrir">↗</button>
          <button class="btn btn--secondary btn--xs" onclick="sourcingSetPrimary('${o.id}')" title="Définir principal">★</button>
          <button class="btn btn--ghost btn--xs" onclick="sourcingDeleteOffer('${o.id}')" title="Supprimer" style="color:#ef4444">🗑</button>
        </td>
      </tr>`;
    }).join('');
  }

  /* ── Toggle panel offres ── */
  window.sourcingToggleOffers = function () {
    const panel = document.getElementById('sourcing-offers-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
  };

  /* ── Chercher meilleur prix ── */
  window.sourcingSearch = function () {
    if (!_productId) { _showStatus('error', 'Sauvegardez d\'abord le produit.'); return; }

    // Récupère le nom + marque depuis les champs du formulaire
    const name  = document.getElementById('name')?.value?.trim() || '';
    const brand = document.getElementById('brand')?.value?.trim() || '';
    if (!name) { _showStatus('error', 'Nom du produit manquant.'); return; }

    _showStatus('loading', 'Recherche des meilleures offres en cours…');

    // Prépare les URLs de recherche sur sources principales
    const query = encodeURIComponent(`${brand} ${name}`.trim());
    const sources = [
      { name: 'Amazon FR', url: `https://www.amazon.fr/s?k=${query}` },
      { name: 'Cdiscount',  url: `https://www.cdiscount.com/search/10/${query}.html` },
      { name: 'FNAC',       url: `https://www.fnac.com/SearchResult/ResultList.aspx?SCat=0!1&sft=1&sa=0&sf=101&query=${query}` },
      { name: 'LDLC',       url: `https://www.ldlc.com/recherche/${query}/` },
      { name: 'Boulanger',  url: `https://www.boulanger.com/recherche?q=${query}` },
    ];

    // Phase 2 : recherche automatique via API dédiée
    // Pour l'instant, ouvre les liens dans une fenêtre pour review manuelle
    _showStatus('info',
      `Recherche préparée pour <strong>${_esc(brand)} ${_esc(name)}</strong>.<br>
      ${sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.name}</a>`).join(' · ')}<br>
      <small>Ajoutez les offres manuellement via "+ Ajouter manuellement"</small>`
    );

    // Afficher le panel offres
    const panel = document.getElementById('sourcing-offers-panel');
    if (panel) panel.style.display = '';
  };

  /* ── Modale ajout manuel ── */
  window.sourcingAddOffer = function () {
    _editOfferId = null;
    ['modal-supplier-name','modal-supplier-url','modal-title',
     'modal-price','modal-shipping','modal-delivery'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('modal-availability').value = 'unknown';
    document.getElementById('modal-confidence').value = '80';
    document.getElementById('sourcing-add-modal').style.display = 'flex';
  };

  window.sourcingCloseModal = function () {
    document.getElementById('sourcing-add-modal').style.display = 'none';
  };

  window.sourcingSaveOffer = async function () {
    const name = document.getElementById('modal-supplier-name')?.value?.trim();
    const url  = document.getElementById('modal-supplier-url')?.value?.trim();
    if (!name || !url) { alert('Fournisseur et URL requis.'); return; }
    if (!_productId) { alert('Sauvegardez le produit d\'abord.'); return; }

    const price    = parseFloat(document.getElementById('modal-price')?.value) || null;
    const shipping = parseFloat(document.getElementById('modal-shipping')?.value) || null;
    const conf     = parseInt(document.getElementById('modal-confidence')?.value) || 80;

    const payload = {
      product_id:        _productId,
      supplier_name:     name,
      supplier_url:      url,
      title:             document.getElementById('modal-title')?.value?.trim() || null,
      price,
      shipping_price:    shipping,
      delivery_estimate: document.getElementById('modal-delivery')?.value?.trim() || null,
      availability:      document.getElementById('modal-availability')?.value || 'unknown',
      confidence:        conf,
      score:             _computeScore({ price, shipping_price: shipping, availability: document.getElementById('modal-availability')?.value, confidence: conf }),
      source:            'manual',
    };

    try {
      if (_editOfferId) {
        await api.put(`/api/suppliers/offers?offer_id=${_editOfferId}`, payload);
      } else {
        await api.post('/api/suppliers/offers', payload);
      }
      sourcingCloseModal();
      await _loadOffers();
      _showStatus('success', 'Offre enregistrée avec succès.');
    } catch (e) {
      _showStatus('error', 'Erreur: ' + e.message);
    }
  };

  /* ── Définir offre comme principale ── */
  window.sourcingSetPrimary = async function (offerId) {
    if (!_productId) return;
    const offer = _offers.find(o => o.id === offerId);
    if (!offer) return;

    if (offer.confidence < 70) {
      if (!confirm(`Confiance faible (${offer.confidence}%). Définir quand même comme lien principal ?`)) return;
    }

    try {
      await api.patch(`/api/suppliers/offers?offer_id=${offerId}&product_id=${_productId}`, {});
      // Met à jour les champs du formulaire
      document.getElementById('supplier_url').value          = offer.supplier_url || '';
      document.getElementById('supplier_name').value         = offer.supplier_name || '';
      document.getElementById('supplier_price').value        = offer.price || '';
      document.getElementById('supplier_shipping').value     = offer.shipping_price || '';
      document.getElementById('supplier_delivery').value     = offer.delivery_estimate || '';
      document.getElementById('supplier_availability').value = offer.availability || 'unknown';
      _updateBuyButton();
      await _loadOffers();
      _showStatus('success', 'Lien fournisseur principal mis à jour. N\'oubliez pas de sauvegarder le produit.');
    } catch (e) {
      _showStatus('error', 'Erreur: ' + e.message);
    }
  };

  /* ── Supprimer une offre ── */
  window.sourcingDeleteOffer = async function (offerId) {
    if (!confirm('Supprimer cette offre ?')) return;
    try {
      await api.delete(`/api/suppliers/offers?offer_id=${offerId}`);
      await _loadOffers();
    } catch (e) {
      _showStatus('error', 'Erreur: ' + e.message);
    }
  };

  /* ── Calcul score (Phase 3 — version simplifiée) ── */
  function _computeScore({ price, shipping_price, availability, confidence }) {
    let score = 0;

    // Prix : heuristique simple (à affiner en Phase 3)
    if (price && price > 0) score += 40;

    // Disponibilité (20%)
    if (availability === 'in_stock') score += 20;
    else if (availability === 'unknown') score += 10;

    // Confiance produit (40%)
    score += ((confidence || 0) / 100) * 40;

    return Math.min(100, Math.round(score));
  }

  /* ── Utilitaires ── */
  function _showStatus(type, msg) {
    const el = document.getElementById('sourcing-status');
    if (!el) return;
    el.style.display = '';
    el.className = `sourcing-status sourcing-status--${type}`;
    el.innerHTML = msg;
    if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Expose pour la suppression via API.delete (admin/js/api.js)
  if (typeof api !== 'undefined' && !api.delete) {
    api.delete = (url) => fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${api._getToken?.() || ''}` }
    }).then(r => { if (!r.ok) throw new Error(r.statusText); });
  }

})();
```

- [ ] **Commit**

```bash
git add admin/js/sourcing.js
git commit -m "feat(sourcing): logique JS sourcing - bouton Acheter, offres, modal manuel"
```

---

### Task 5: Intégration dans product-edit.js

**Files:**
- Modify: `admin/js/product-edit.js`

- [ ] **Appeler `sourcingInit` après chargement du produit**

Trouver la fonction de chargement produit (loadProduct ou similaire). Après que les champs sont remplis avec les données produit, ajouter :

```javascript
// Après le remplissage des champs produit (fin de loadProduct ou similaire) :
if (typeof sourcingInit === 'function') {
  sourcingInit(productId, data);
}
```

- [ ] **Inclure les champs sourcing dans le payload de sauvegarde**

Dans la fonction de sauvegarde (saveProduct), ajouter les données sourcing :

```javascript
// Dans la construction du payload body :
if (typeof sourcingCollectData === 'function') {
  Object.assign(body, sourcingCollectData());
}
```

- [ ] **Commit**

```bash
git add admin/js/product-edit.js
git commit -m "feat(sourcing): intégration sourcing dans product-edit.js (init + save)"
```

---

### Task 6: Styles CSS

**Files:**
- Modify: `admin/css/admin.css`

- [ ] **Ajouter les styles** à la fin de admin.css :

```css
/* ── Sourcing Fournisseur ─────────────────────────────── */
.badge-admin-only {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  background: #fef3c7; color: #d97706; border: 1px solid #fde68a;
  border-radius: 4px; padding: 2px 6px; letter-spacing: .04em;
}
.sourcing-url-row { display: flex; gap: 8px; align-items: center; }
.sourcing-url-row .form-input { flex: 1; }
.sourcing-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.sourcing-status { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 10px; }
.sourcing-status--loading { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
.sourcing-status--success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
.sourcing-status--error   { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.sourcing-status--info    { background: #f8fafc; color: #374151; border: 1px solid #e5e7eb; }
.sourcing-meta { font-size: 12px; color: #6b7280; margin-top: 8px; }
.sourcing-offers-header { display: flex; justify-content: space-between; align-items: center; margin: 16px 0 8px; }
.sourcing-offers-header h4 { margin: 0; font-size: 14px; font-weight: 700; }
.sourcing-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.sourcing-table th { background: #f8fafc; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; border-bottom: 2px solid #e5e7eb; }
.sourcing-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.sourcing-table .sourcing-title { max-width: 180px; }
.sourcing-row--primary { background: #fffbeb; }
.sourcing-actions-cell { display: flex; gap: 4px; }
.score-badge { display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 11px; font-weight: 700; }
.score-high { background: #dcfce7; color: #166534; }
.score-med  { background: #fef9c3; color: #854d0e; }
.score-low  { background: #fee2e2; color: #991b1b; }
.conf-badge { font-size: 11px; color: #6b7280; }
.btn--xs { padding: 3px 8px; font-size: 11px; }
```

- [ ] **Commit**

```bash
git add admin/css/admin.css
git commit -m "feat(sourcing): styles CSS section sourcing fournisseur"
```

---

### Task 7: Deploy + Tests manuels Phase 1

- [ ] **Vérifier la migration a été appliquée** (Supabase Dashboard > Table Editor)
  - Table `product_supplier_offers` existe
  - Colonnes `supplier_url`, `supplier_name`, etc. existent dans `products`

- [ ] **Ouvrir un produit dans l'admin** → vérifier que la section "Sourcing fournisseur" apparaît

- [ ] **Test bouton Acheter** :
  1. Entrer une URL Amazon dans "Lien fournisseur principal"
  2. Le bouton "Acheter" devient actif
  3. Clic → ouvre dans nouvel onglet ✓

- [ ] **Test ajout offre manuelle** :
  1. Clic "Chercher meilleur prix" → affiche les liens de recherche
  2. Clic "+ Ajouter manuellement" → modal s'ouvre
  3. Remplir les champs → "Enregistrer l'offre"
  4. Offre apparaît dans le tableau

- [ ] **Test "Définir comme principal"** :
  1. Clic ★ sur une offre → les champs du formulaire se remplissent
  2. Sauvegarder le produit → données persistées en DB

- [ ] **Vérifier côté client** : ouvrir la boutique publique → aucune mention supplier visible

- [ ] **Commit final phase 1**

```bash
git add -A
git commit -m "feat(sourcing): Phase 1 complète — liens fournisseur, bouton Acheter, offres manuelles"
```

---

## PHASE 2 — Recherche automatique (à implémenter séparément)

### Task 8: Provider architecture + Google Custom Search

**Files:**
- Create: `api/suppliers/search.js`
- Create: `api/_lib/search-providers/google.js`

**Variables d'environnement nécessaires :**
```
GOOGLE_SEARCH_API_KEY=...
GOOGLE_SEARCH_CX=...        # Custom Search Engine ID
SERPAPI_KEY=...              # Alternative : SerpAPI
```

**Logique :**
1. Construire la requête de recherche à partir du produit (nom + marque + specs)
2. Appeler Google Custom Search API ou SerpAPI
3. Parser les résultats (title, url, snippet, price si disponible)
4. Calculer un score de confiance (matching marque, modèle, etc.)
5. Retourner la liste triée par score

*(Implémentation complète dans un plan séparé une fois les API keys disponibles)*

---

## PHASE 3 — Scoring avancé (à implémenter séparément)

### Task 9: Algorithme de scoring

**Pondération :**
- Prix total (prix + livraison) : 40%
- Délai de livraison : 25%
- Disponibilité en stock : 20%
- Fiabilité du fournisseur (whitelist) : 10%
- Confiance correspondance produit : 5%

**Fournisseurs de confiance (score bonus) :**
`amazon.fr`, `amazon.com`, `ldlc.com`, `fnac.com`, `darty.com`, `boulanger.com`, `cdiscount.com`

*(Implémentation dans plan séparé)*

---

## Résumé final

**Fichiers modifiés/créés :**
- `supabase/migrations/010_supplier_sourcing.sql`
- `api/suppliers/offers.js`
- `admin/products/edit.html`
- `admin/js/sourcing.js`
- `admin/js/product-edit.js`
- `admin/css/admin.css`

**Variables d'environnement (Phase 2) :**
- `GOOGLE_SEARCH_API_KEY`
- `GOOGLE_SEARCH_CX`

**Sécurité :**
- Table `product_supplier_offers` → RLS activé, authentification requise
- Colonnes `supplier_*` → jamais retournées par l'API publique GET /api/products (select explicite côté API)
- Le script `sourcing.js` est uniquement dans `/admin/` → jamais chargé côté client
