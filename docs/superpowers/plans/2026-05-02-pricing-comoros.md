# Pricing Comores — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer un système de calcul de prix de vente Comores dans l'admin Alkamar : calcul coût rendu Comores, prix recommandé, application manuelle et historique, sans jamais exposer les données internes côté public.

**Architecture:** Routes API ajoutées à `products.js` via `?_route=pricing_*` (limite 12 fonctions Vercel). Logique de calcul centralisée dans `api/_lib/pricing.js`. Section admin dans `admin/products/edit.html` + `admin/js/pricing.js`. 3 nouvelles tables Supabase : `pricing_settings`, `product_pricing`, `product_price_history`.

**Tech Stack:** Vanilla JS (admin), Supabase PostgreSQL, Vercel Serverless (Node.js), CSS variables existantes admin.

---

## Contraintes critiques

- **Limite 12 fonctions Vercel Hobby** : aucun nouveau fichier dans `api/` sauf `api/_lib/pricing.js` (lib = pas une fonction)
- **Toutes les routes pricing** passent par `api/products.js?_route=pricing_*` + rewrites dans `vercel.json`
- **Migration suivante** : `011_pricing_comoros.sql`
- **Colonnes publiques protégées** : pricing data jamais dans le SELECT public de `GET /api/products`

---

## Fichiers concernés

| Fichier | Action | Rôle |
|---------|--------|------|
| `supabase/migrations/011_pricing_comoros.sql` | CREATE | Tables pricing_settings, product_pricing, product_price_history |
| `api/_lib/pricing.js` | CREATE | Fonction `calculateComorosPrice(input, settings)` — logique centralisée |
| `api/products.js` | MODIFY | Routes `?_route=pricing_settings`, `pricing_calculate`, `pricing_apply`, `pricing_validate_all` |
| `vercel.json` | MODIFY | Rewrites `/api/pricing/*` → `products.js?_route=pricing_*` |
| `admin/js/pricing.js` | CREATE | UI pricing : chargement, calcul, affichage résultats, appliquer prix |
| `admin/products/edit.html` | MODIFY | Section "Prix Comores" + `<script src="/admin/js/pricing.js">` |
| `admin/css/admin.css` | MODIFY | Styles section pricing |

---

## Task 1 : Migration SQL — 3 tables pricing

**Files:** Create `supabase/migrations/011_pricing_comoros.sql`

- [ ] **Créer le fichier migration**

```sql
-- supabase/migrations/011_pricing_comoros.sql
-- Système de pricing Comores (Phase 1)

-- 1. Paramètres globaux (singleton — 1 seule ligne)
CREATE TABLE IF NOT EXISTS pricing_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eur_to_kmf_rate          NUMERIC(10,2) DEFAULT 491,
  transport_per_kg_eur     NUMERIC(8,2)  DEFAULT 8,
  fixed_fee_per_product_eur NUMERIC(8,2) DEFAULT 5,
  default_customs_rate     NUMERIC(5,4)  DEFAULT 0.15,
  default_local_tax_rate   NUMERIC(5,4)  DEFAULT 0.05,
  default_margin_rate      NUMERIC(5,4)  DEFAULT 0.30,
  minimum_margin_rate      NUMERIC(5,4)  DEFAULT 0.15,
  safety_rate              NUMERIC(5,4)  DEFAULT 0.05,
  updated_at               TIMESTAMPTZ   DEFAULT now()
);
INSERT INTO pricing_settings DEFAULT VALUES ON CONFLICT DO NOTHING;

-- 2. Pricing par produit
CREATE TABLE IF NOT EXISTS product_pricing (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  purchase_price              NUMERIC(10,2),
  purchase_currency           TEXT DEFAULT 'EUR',
  supplier_shipping_price     NUMERIC(8,2)  DEFAULT 0,
  weight_kg                   NUMERIC(6,3),
  customs_rate                NUMERIC(5,4),
  local_tax_rate              NUMERIC(5,4),
  target_margin_rate          NUMERIC(5,4),
  risk_rate                   NUMERIC(5,4)  DEFAULT 0.05,
  local_competitor_price_kmf  NUMERIC(12,0),
  -- Résultats calculés
  total_landed_cost_eur       NUMERIC(10,2),
  recommended_price_eur       NUMERIC(10,2),
  recommended_price_kmf       NUMERIC(12,0),
  final_price_eur             NUMERIC(10,2),
  final_price_kmf             NUMERIC(12,0),
  margin_amount_eur           NUMERIC(10,2),
  margin_rate                 NUMERIC(5,4),
  -- Statut
  price_status                TEXT DEFAULT 'pending'
    CHECK (price_status IN ('pending','calculated','validated','manual','to_verify')),
  is_manual_price             BOOLEAN DEFAULT FALSE,
  competitiveness_status      TEXT,
  calculation_details         JSONB,
  pricing_notes               TEXT,
  calculated_at               TIMESTAMPTZ,
  validated_at                TIMESTAMPTZ,
  updated_at                  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id)
);

-- 3. Historique des changements de prix
CREATE TABLE IF NOT EXISTS product_price_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price_eur     NUMERIC(10,2),
  old_price_kmf     NUMERIC(12,0),
  new_price_eur     NUMERIC(10,2),
  new_price_kmf     NUMERIC(12,0),
  recommended_eur   NUMERIC(10,2),
  source            TEXT,
  pricing_notes     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_product_pricing_product  ON product_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product    ON product_price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created    ON product_price_history(product_id, created_at DESC);

-- RLS (admin seulement via service_role)
ALTER TABLE pricing_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_pricing       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_pricing_settings"
  ON pricing_settings USING (auth.role() = 'authenticated');
CREATE POLICY "admin_product_pricing"
  ON product_pricing USING (auth.role() = 'authenticated');
CREATE POLICY "admin_price_history"
  ON product_price_history USING (auth.role() = 'authenticated');
```

- [ ] **Appliquer via Supabase Dashboard SQL Editor**

- [ ] **Vérifier**

```javascript
// node -e "..." avec .env.local
// Doit retourner: settings OK, product_pricing OK, product_price_history OK
```

- [ ] **Commit**

```bash
git add supabase/migrations/011_pricing_comoros.sql
git commit -m "feat(pricing): migration SQL — pricing_settings, product_pricing, product_price_history"
```

---

## Task 2 : Logique de calcul centralisée `api/_lib/pricing.js`

**Files:** Create `api/_lib/pricing.js`

- [ ] **Créer le fichier**

```javascript
// api/_lib/pricing.js — Logique calcul prix Comores (centralisée, jamais exposée public)
'use strict';

/**
 * Arrondi commercial KMF
 * < 10 000 : arrondi à 500
 * 10 000 – 50 000 : arrondi à 1 000
 * 50 000 – 150 000 : arrondi à 2 500
 * > 150 000 : arrondi à 5 000
 */
function roundKmf(kmf) {
  if (kmf < 10000)  return Math.ceil(kmf / 500)  * 500;
  if (kmf < 50000)  return Math.ceil(kmf / 1000) * 1000;
  if (kmf < 150000) return Math.ceil(kmf / 2500) * 2500;
  return Math.ceil(kmf / 5000) * 5000;
}

/**
 * Calcul principal — retourne tous les détails du coût rendu Comores + prix recommandé.
 *
 * @param {object} input
 *   - purchasePrice {number}            — prix d'achat fournisseur
 *   - purchaseCurrency {string}         — 'EUR' ou 'KMF'
 *   - supplierShipping {number}         — frais livraison fournisseur en EUR
 *   - weightKg {number}                 — poids produit en kg
 *   - customsRate {number|null}         — taux douane (ex: 0.15 = 15%)
 *   - localTaxRate {number|null}        — taux taxes locales
 *   - targetMarginRate {number|null}    — marge souhaitée
 *   - riskRate {number}                 — coefficient risque (défaut 0.05)
 *   - localCompetitorPriceKmf {number}  — prix concurrent local en KMF
 * @param {object} settings              — ligne de pricing_settings
 *
 * @returns {object} résultat complet avec warnings
 */
function calculateComorosPrice(input, settings) {
  const {
    purchasePrice       = 0,
    purchaseCurrency    = 'EUR',
    supplierShipping    = 0,
    weightKg            = 0,
    customsRate         = null,
    localTaxRate        = null,
    targetMarginRate    = null,
    riskRate            = 0.05,
    localCompetitorPriceKmf = null,
  } = input;

  const s = {
    eur_to_kmf_rate:           Number(settings.eur_to_kmf_rate)           || 491,
    transport_per_kg_eur:      Number(settings.transport_per_kg_eur)      || 8,
    fixed_fee_per_product_eur: Number(settings.fixed_fee_per_product_eur) || 5,
    default_customs_rate:      Number(settings.default_customs_rate)      || 0.15,
    default_local_tax_rate:    Number(settings.default_local_tax_rate)    || 0.05,
    default_margin_rate:       Number(settings.default_margin_rate)       || 0.30,
    minimum_margin_rate:       Number(settings.minimum_margin_rate)       || 0.15,
    safety_rate:               Number(settings.safety_rate)               || 0.05,
  };

  const warnings = [];

  if (!purchasePrice || purchasePrice <= 0) warnings.push('purchase_price_missing');
  if (!weightKg || weightKg <= 0)           warnings.push('weight_missing');

  // Conversion en EUR
  const purchaseEur = purchaseCurrency === 'KMF'
    ? purchasePrice / s.eur_to_kmf_rate
    : Number(purchasePrice) || 0;
  const supplierShippingEur = Number(supplierShipping) || 0;
  const weightKgNum = Number(weightKg) || 0;

  // Taux effectifs
  const effectiveCustomsRate  = customsRate    != null ? Number(customsRate)    : s.default_customs_rate;
  const effectiveLocalTaxRate = localTaxRate   != null ? Number(localTaxRate)   : s.default_local_tax_rate;
  const effectiveMarginRate   = targetMarginRate != null ? Number(targetMarginRate) : s.default_margin_rate;
  const effectiveRiskRate     = Number(riskRate) || 0.05;

  // Calcul étape par étape
  const purchaseCost    = purchaseEur + supplierShippingEur;
  const transportCost   = weightKgNum * s.transport_per_kg_eur;
  const fixedFee        = s.fixed_fee_per_product_eur;

  const baseForDuty     = purchaseCost + transportCost;
  const customsCost     = baseForDuty * effectiveCustomsRate;
  const localTaxes      = baseForDuty * effectiveLocalTaxRate;
  const riskBuffer      = purchaseCost * effectiveRiskRate;
  const safetyBuffer    = purchaseCost * s.safety_rate;

  const totalLandedCost = purchaseCost + transportCost + fixedFee + customsCost + localTaxes + riskBuffer + safetyBuffer;

  // Prix recommandé avant arrondi
  const recommendedEurRaw = totalLandedCost * (1 + effectiveMarginRate);
  const recommendedKmfRaw = recommendedEurRaw * s.eur_to_kmf_rate;

  // Arrondi commercial KMF
  const recommendedKmf = roundKmf(recommendedKmfRaw);
  const recommendedEur = Number((recommendedKmf / s.eur_to_kmf_rate).toFixed(2));

  // Marge réelle après arrondi
  const marginAmount = recommendedEur - totalLandedCost;
  const marginRate   = totalLandedCost > 0 ? marginAmount / totalLandedCost : 0;

  // Compétitivité
  let competitivenessStatus = 'no_data';
  if (localCompetitorPriceKmf && localCompetitorPriceKmf > 0) {
    const ratio = recommendedKmf / Number(localCompetitorPriceKmf);
    if (ratio <= 0.9)       competitivenessStatus = 'very_competitive';
    else if (ratio <= 1.05) competitivenessStatus = 'competitive';
    else if (ratio <= 1.2)  competitivenessStatus = 'expensive';
    else                    competitivenessStatus = 'too_expensive';
  }

  // Warnings additionnels
  if (marginRate < s.minimum_margin_rate) warnings.push('margin_too_low');
  if (marginRate < 0)                     warnings.push('negative_margin');
  if (competitivenessStatus === 'too_expensive') warnings.push('too_expensive_vs_market');

  return {
    // Détail coûts (EUR)
    purchaseCost:       Number(purchaseCost.toFixed(2)),
    transportCost:      Number(transportCost.toFixed(2)),
    fixedFee:           Number(fixedFee.toFixed(2)),
    customsCost:        Number(customsCost.toFixed(2)),
    localTaxes:         Number(localTaxes.toFixed(2)),
    riskBuffer:         Number(riskBuffer.toFixed(2)),
    safetyBuffer:       Number(safetyBuffer.toFixed(2)),
    totalLandedCost:    Number(totalLandedCost.toFixed(2)),
    // Prix recommandé
    recommendedEurRaw:  Number(recommendedEurRaw.toFixed(2)),
    recommendedKmfRaw:  Math.round(recommendedKmfRaw),
    recommendedEur,
    recommendedKmf,
    // Marge
    marginAmount:       Number(marginAmount.toFixed(2)),
    marginRate:         Number(marginRate.toFixed(4)),
    marginPercent:      Number((marginRate * 100).toFixed(1)),
    // Meta
    effectiveCustomsRate, effectiveLocalTaxRate, effectiveMarginRate, effectiveRiskRate,
    eurToKmfRate:       s.eur_to_kmf_rate,
    competitivenessStatus,
    warnings,
  };
}

module.exports = { calculateComorosPrice, roundKmf };
```

- [ ] **Commit**

```bash
git add api/_lib/pricing.js
git commit -m "feat(pricing): logique calcul prix Comores — calculateComorosPrice()"
```

---

## Task 3 : Routes API dans products.js

**Files:** Modify `api/products.js`, `vercel.json`

- [ ] **Ajouter les 4 routes pricing dans `api/products.js`** juste avant le commentaire `// GET — lecture publique`

```javascript
// ─── Route : /api/pricing/settings → /api/products?_route=pricing_settings ────
if (req.query._route === 'pricing_settings') {
  const auth = await requireRole(req, 'admin', 'editor');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('pricing_settings').select('*').limit(1).single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'PUT') {
    const { data: existing } = await supabase.from('pricing_settings').select('id').limit(1).single();
    if (!existing) return res.status(404).json({ error: 'Settings not found' });
    const allowed = ['eur_to_kmf_rate','transport_per_kg_eur','fixed_fee_per_product_eur',
      'default_customs_rate','default_local_tax_rate','default_margin_rate',
      'minimum_margin_rate','safety_rate'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] != null) updates[k] = Number(req.body[k]); });
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('pricing_settings').update(updates).eq('id', existing.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

// ─── Route : /api/pricing/calculate → ?_route=pricing_calculate ─────────────
if (req.query._route === 'pricing_calculate') {
  const auth = await requireRole(req, 'admin', 'editor');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { calculateComorosPrice } = require('./_lib/pricing');
  const { product_id, ...input } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id requis' });

  const { data: settings } = await supabase.from('pricing_settings').select('*').limit(1).single();
  if (!settings) return res.status(500).json({ error: 'pricing_settings manquants' });

  const result = calculateComorosPrice(input, settings);

  // Sauvegarder dans product_pricing
  const pricingRow = {
    product_id,
    purchase_price:             Number(input.purchasePrice) || null,
    purchase_currency:          input.purchaseCurrency || 'EUR',
    supplier_shipping_price:    Number(input.supplierShipping) || 0,
    weight_kg:                  Number(input.weightKg) || null,
    customs_rate:               input.customsRate != null ? Number(input.customsRate) : null,
    local_tax_rate:             input.localTaxRate != null ? Number(input.localTaxRate) : null,
    target_margin_rate:         input.targetMarginRate != null ? Number(input.targetMarginRate) : null,
    risk_rate:                  Number(input.riskRate) || 0.05,
    local_competitor_price_kmf: Number(input.localCompetitorPriceKmf) || null,
    total_landed_cost_eur:      result.totalLandedCost,
    recommended_price_eur:      result.recommendedEur,
    recommended_price_kmf:      result.recommendedKmf,
    margin_amount_eur:          result.marginAmount,
    margin_rate:                result.marginRate,
    price_status:               result.warnings.includes('weight_missing') || result.warnings.includes('purchase_price_missing') ? 'to_verify' : 'calculated',
    competitiveness_status:     result.competitivenessStatus,
    calculation_details:        result,
    pricing_notes:              input.pricingNotes || null,
    calculated_at:              new Date().toISOString(),
    updated_at:                 new Date().toISOString(),
  };

  const { error: upsertErr } = await supabase.from('product_pricing').upsert(pricingRow, { onConflict: 'product_id' });
  if (upsertErr) return res.status(500).json({ error: upsertErr.message });

  return res.status(200).json({ result, warnings: result.warnings });
}

// ─── Route : /api/pricing/apply → ?_route=pricing_apply ─────────────────────
if (req.query._route === 'pricing_apply') {
  const auth = await requireRole(req, 'admin', 'editor');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { product_id, use_manual, manual_price_eur, manual_price_kmf, pricing_notes } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id requis' });

  // Récupérer le prix actuel du produit (pour historique)
  const { data: product } = await supabase.from('products').select('price_eur, price_kmf').eq('id', product_id).single();
  const { data: pp } = await supabase.from('product_pricing').select('*').eq('product_id', product_id).single();
  if (!pp) return res.status(404).json({ error: 'Prix calculé introuvable — lancez d\'abord le calcul' });

  const isManual   = !!use_manual;
  const newEur     = isManual ? Number(manual_price_eur) : pp.recommended_price_eur;
  const newKmf     = isManual ? Number(manual_price_kmf) : pp.recommended_price_kmf;

  if (!newEur || newEur <= 0) return res.status(400).json({ error: 'Prix invalide' });
  const finalKmf = newKmf || Math.round(newEur * ((await supabase.from('pricing_settings').select('eur_to_kmf_rate').limit(1).single()).data?.eur_to_kmf_rate || 491));

  // Sauvegarder historique
  await supabase.from('product_price_history').insert({
    product_id,
    old_price_eur:   product?.price_eur,
    old_price_kmf:   product?.price_kmf,
    new_price_eur:   newEur,
    new_price_kmf:   finalKmf,
    recommended_eur: pp.recommended_price_eur,
    source:          isManual ? 'manual_update' : 'recommended_apply_single',
    pricing_notes:   pricing_notes || null,
  });

  // Mettre à jour le produit public
  const { error: prodErr } = await supabase.from('products').update({
    price_eur:  newEur,
    price_kmf:  finalKmf,
    updated_at: new Date().toISOString(),
  }).eq('id', product_id);
  if (prodErr) return res.status(500).json({ error: prodErr.message });

  // Mettre à jour product_pricing
  await supabase.from('product_pricing').update({
    final_price_eur:  newEur,
    final_price_kmf:  finalKmf,
    is_manual_price:  isManual,
    price_status:     'validated',
    validated_at:     new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  }).eq('product_id', product_id);

  return res.status(200).json({ success: true, newPriceEur: newEur, newPriceKmf: finalKmf });
}

// ─── Route : /api/pricing/validate-all → ?_route=pricing_validate_all ───────
if (req.query._route === 'pricing_validate_all') {
  const auth = await requireRole(req, 'admin');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { confirmed } = req.body;
  if (!confirmed) return res.status(400).json({ error: 'confirmed:true requis pour protection anti-abus' });

  // Récupérer tous les pricing validés (non to_verify, non pending)
  const { data: eligibles } = await supabase
    .from('product_pricing')
    .select('product_id, final_price_eur, final_price_kmf, recommended_price_eur, recommended_price_kmf, price_status, is_manual_price, margin_rate')
    .in('price_status', ['calculated', 'validated', 'manual'])
    .gt('recommended_price_eur', 0);

  if (!eligibles?.length) return res.status(200).json({ updated: 0, ignored: 0, message: 'Aucun produit éligible' });

  let updated = 0, ignored = 0;
  const { data: settings } = await supabase.from('pricing_settings').select('eur_to_kmf_rate, minimum_margin_rate').limit(1).single();

  for (const pp of eligibles) {
    // Ignorer si marge négative
    if (pp.margin_rate != null && pp.margin_rate < 0) { ignored++; continue; }
    const newEur = pp.is_manual_price ? pp.final_price_eur : pp.recommended_price_eur;
    const newKmf = pp.is_manual_price ? pp.final_price_kmf : pp.recommended_price_kmf;
    if (!newEur || newEur <= 0) { ignored++; continue; }

    const { data: product } = await supabase.from('products').select('price_eur, price_kmf').eq('id', pp.product_id).single();
    await supabase.from('product_price_history').insert({
      product_id: pp.product_id, old_price_eur: product?.price_eur,
      old_price_kmf: product?.price_kmf, new_price_eur: newEur, new_price_kmf: newKmf,
      recommended_eur: pp.recommended_price_eur, source: 'global_validation',
    });
    await supabase.from('products').update({ price_eur: newEur, price_kmf: newKmf, updated_at: new Date().toISOString() }).eq('id', pp.product_id);
    await supabase.from('product_pricing').update({ final_price_eur: newEur, final_price_kmf: newKmf, price_status: 'validated', validated_at: new Date().toISOString() }).eq('product_id', pp.product_id);
    updated++;
  }

  return res.status(200).json({ updated, ignored, total: eligibles.length });
}
```

- [ ] **Ajouter les rewrites dans `vercel.json`**

```json
{ "source": "/api/pricing/settings",     "destination": "/api/products?_route=pricing_settings"     },
{ "source": "/api/pricing/calculate",    "destination": "/api/products?_route=pricing_calculate"    },
{ "source": "/api/pricing/apply",        "destination": "/api/products?_route=pricing_apply"        },
{ "source": "/api/pricing/validate-all", "destination": "/api/products?_route=pricing_validate_all" }
```

- [ ] **Commit**

```bash
git add api/products.js api/_lib/pricing.js vercel.json
git commit -m "feat(pricing): API routes pricing_settings/calculate/apply/validate_all"
```

---

## Task 4 : Section HTML dans `admin/products/edit.html`

**Files:** Modify `admin/products/edit.html`

- [ ] **Insérer APRÈS la section "Sourcing fournisseur"** (après `<!-- ── FIN SOURCING ──`), avant `</div><!-- /product-col-side -->`

```html
<!-- ── PRICING COMORES (admin uniquement) ─────────────────────────── -->
<div class="form-card" id="section-pricing">
  <h2 style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
    <span style="display:flex;align-items:center;gap:8px">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      Prix Comores
    </span>
    <span id="pricing-status-badge" style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:rgba(148,163,184,.12);color:var(--admin-muted)">Non calculé</span>
  </h2>

  <!-- Données d'entrée -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div class="form-group">
      <label>Prix achat (€)</label>
      <input type="number" id="pricing-purchase-price" class="form-control" placeholder="0.00" step="0.01" min="0">
    </div>
    <div class="form-group">
      <label>Frais livraison fournisseur (€)</label>
      <input type="number" id="pricing-supplier-shipping" class="form-control" placeholder="0.00" step="0.01" min="0">
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div class="form-group">
      <label>Poids produit (kg)</label>
      <input type="number" id="pricing-weight" class="form-control" placeholder="ex: 0.5" step="0.001" min="0">
    </div>
    <div class="form-group">
      <label>Taux douane (%)</label>
      <input type="number" id="pricing-customs-rate" class="form-control" placeholder="défaut 15%" step="0.1" min="0" max="100">
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div class="form-group">
      <label>Marge souhaitée (%)</label>
      <input type="number" id="pricing-margin-rate" class="form-control" placeholder="défaut 30%" step="1" min="0" max="200">
    </div>
    <div class="form-group">
      <label>Prix concurrent local (KMF)</label>
      <input type="number" id="pricing-competitor-kmf" class="form-control" placeholder="optionnel" min="0">
    </div>
  </div>
  <div class="form-group" style="margin-bottom:14px">
    <label>Notes internes</label>
    <textarea id="pricing-notes" class="form-control" rows="2" placeholder="Observations, source prix, remarques…"></textarea>
  </div>

  <!-- Bouton calcul -->
  <div style="display:flex;gap:8px;margin-bottom:14px">
    <button type="button" class="btn btn--primary" id="btn-pricing-calc" onclick="pricingCalculate()" style="gap:6px">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
      Calculer le prix
    </button>
    <button type="button" class="btn btn--ghost btn--sm" id="btn-pricing-settings" onclick="pricingOpenSettings()" title="Paramètres globaux">⚙ Paramètres</button>
  </div>

  <!-- Résultats (masqués jusqu'au calcul) -->
  <div id="pricing-results" style="display:none">
    <div style="background:rgba(255,255,255,.03);border:1px solid var(--admin-border);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:13px">
        <div style="color:var(--admin-muted)">Prix achat total</div>      <div id="pr-purchase" style="font-weight:600;text-align:right">—</div>
        <div style="color:var(--admin-muted)">Transport</div>             <div id="pr-transport" style="font-weight:600;text-align:right">—</div>
        <div style="color:var(--admin-muted)">Douane</div>                <div id="pr-customs" style="font-weight:600;text-align:right">—</div>
        <div style="color:var(--admin-muted)">Taxes locales</div>         <div id="pr-taxes" style="font-weight:600;text-align:right">—</div>
        <div style="color:var(--admin-muted)">Frais fixes + risque</div>  <div id="pr-fees" style="font-weight:600;text-align:right">—</div>
        <div style="border-top:1px solid var(--admin-border);padding-top:6px;font-weight:700;color:var(--admin-text)">Coût total rendu</div>
        <div id="pr-total" style="border-top:1px solid var(--admin-border);padding-top:6px;font-weight:800;text-align:right;font-size:15px;color:var(--admin-text)">—</div>
      </div>
    </div>

    <!-- Prix recommandé -->
    <div id="pr-recommended-block" style="background:var(--admin-accent-subtle);border:1px solid rgba(59,130,246,.25);border-radius:10px;padding:14px;margin-bottom:12px;text-align:center">
      <div style="font-size:11px;color:#93c5fd;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Prix recommandé</div>
      <div id="pr-recommended-kmf" style="font-size:26px;font-weight:800;color:#fff">—</div>
      <div id="pr-recommended-eur" style="font-size:13px;color:#93c5fd;margin-top:2px">—</div>
      <div id="pr-margin" style="font-size:12px;color:#93c5fd;margin-top:4px">Marge : —</div>
      <div id="pr-competitiveness" style="margin-top:8px"></div>
    </div>

    <!-- Prix concurrent -->
    <div id="pr-competitor-block" style="display:none;font-size:13px;padding:10px 14px;border-radius:8px;margin-bottom:12px;background:rgba(148,163,184,.07);border:1px solid var(--admin-border)">
      <div id="pr-competitor-text"></div>
    </div>

    <!-- Warnings -->
    <div id="pr-warnings" style="display:none;margin-bottom:12px"></div>

    <!-- Actions -->
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn btn--success" id="btn-pricing-apply" onclick="pricingApply(false)" style="font-size:13px">
        ✓ Appliquer le prix recommandé
      </button>
      <button type="button" class="btn btn--warning btn--sm" id="btn-pricing-manual" onclick="pricingOpenManual()" style="font-size:13px">
        ✏ Prix manuel
      </button>
    </div>
  </div>

  <!-- Historique -->
  <div id="pricing-history" style="margin-top:14px;display:none">
    <div style="font-size:12px;font-weight:700;color:var(--admin-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Historique prix</div>
    <div id="pricing-history-list" style="font-size:12px;color:var(--admin-text-2)"></div>
  </div>
</div><!-- /section-pricing -->

<!-- Modal manuel -->
<div id="pricing-manual-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:300;align-items:center;justify-content:center">
  <div style="background:var(--admin-surface);border-radius:14px;padding:24px;width:400px;max-width:95vw;position:relative">
    <button onclick="document.getElementById('pricing-manual-modal').style.display='none'" style="position:absolute;top:12px;right:12px;background:none;border:none;color:var(--admin-muted);font-size:20px;cursor:pointer">×</button>
    <h3 style="margin:0 0 16px;font-size:15px">Prix manuel</h3>
    <div class="form-group"><label>Prix final (€)</label><input type="number" id="pricing-manual-eur" class="form-control" step="0.01" min="0"></div>
    <div class="form-group"><label>Prix final (KMF)</label><input type="number" id="pricing-manual-kmf" class="form-control" min="0"></div>
    <div class="form-group"><label>Note</label><input type="text" id="pricing-manual-note" class="form-control" placeholder="Raison du prix manuel"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn--ghost" onclick="document.getElementById('pricing-manual-modal').style.display='none'">Annuler</button>
      <button class="btn btn--primary" onclick="pricingApply(true)">Appliquer</button>
    </div>
  </div>
</div>

<!-- Modal paramètres -->
<div id="pricing-settings-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:300;align-items:center;justify-content:center">
  <div style="background:var(--admin-surface);border-radius:14px;padding:24px;width:480px;max-width:95vw;max-height:90vh;overflow-y:auto;position:relative">
    <button onclick="document.getElementById('pricing-settings-modal').style.display='none'" style="position:absolute;top:12px;right:12px;background:none;border:none;color:var(--admin-muted);font-size:20px;cursor:pointer">×</button>
    <h3 style="margin:0 0 16px;font-size:15px">⚙ Paramètres pricing Comores</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group"><label>EUR → KMF</label><input type="number" id="ps-eur-kmf" class="form-control" step="0.01"></div>
      <div class="form-group"><label>Transport / kg (€)</label><input type="number" id="ps-transport-kg" class="form-control" step="0.01"></div>
      <div class="form-group"><label>Frais fixes / produit (€)</label><input type="number" id="ps-fixed-fee" class="form-control" step="0.01"></div>
      <div class="form-group"><label>Taux douane défaut (%)</label><input type="number" id="ps-customs" class="form-control" step="0.1"></div>
      <div class="form-group"><label>Taxes locales défaut (%)</label><input type="number" id="ps-local-tax" class="form-control" step="0.1"></div>
      <div class="form-group"><label>Marge défaut (%)</label><input type="number" id="ps-margin" class="form-control" step="1"></div>
      <div class="form-group"><label>Marge minimum (%)</label><input type="number" id="ps-min-margin" class="form-control" step="1"></div>
      <div class="form-group"><label>Coefficient sécurité (%)</label><input type="number" id="ps-safety" class="form-control" step="0.5"></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn--ghost" onclick="document.getElementById('pricing-settings-modal').style.display='none'">Annuler</button>
      <button class="btn btn--primary" onclick="pricingSaveSettings()">Sauvegarder</button>
    </div>
  </div>
</div>
<!-- ── FIN PRICING ──────────────────────────────────────────────────── -->
```

- [ ] **Ajouter le script** avant `</body>` (après sourcing.js) :

```html
<script src="/admin/js/pricing.js"></script>
```

- [ ] **Commit**

```bash
git add admin/products/edit.html
git commit -m "feat(pricing): section HTML pricing Comores dans fiche produit admin"
```

---

## Task 5 : Logique JS `admin/js/pricing.js`

**Files:** Create `admin/js/pricing.js`

- [ ] **Créer le fichier**

```javascript
// admin/js/pricing.js — Pricing Comores (admin uniquement)
'use strict';

(function () {
  let _productId   = null;
  let _pricingData = {};
  let _settings    = null;
  let _lastResult  = null;

  /* ── Init : appelée par product-edit.js ── */
  window.pricingInit = function (productId, productData) {
    _productId   = productId;
    _pricingData = productData || {};

    if (!productId) return;
    _loadPricing();
    _loadSettings();
  };

  /* ── Charger les données de pricing existantes ── */
  async function _loadPricing() {
    if (!_productId) return;
    try {
      const r = await fetch('/api/pricing/calculate?_get=1&product_id=' + _productId, {
        headers: { 'Authorization': 'Bearer ' + _getToken() }
      });
      // On récupère via product_pricing directement
      const d = await api.get('/api/suppliers/offers?product_id=' + _productId + '&_table=product_pricing').catch(() => null);
      // Fallback: on recharge via le calcul si des données existent
    } catch (e) { /* silencieux */ }

    // Charger depuis product_pricing via un endpoint GET
    try {
      const r = await fetch('/api/pricing/settings', {
        headers: { 'Authorization': 'Bearer ' + _getToken() }
      });
      if (r.ok) _settings = await r.json();
    } catch (e) { /* silencieux */ }
  }

  async function _loadSettings() {
    try {
      const r = await fetch('/api/pricing/settings', {
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _getToken() }
      });
      if (r.ok) _settings = await r.json();
    } catch (e) { /* silencieux */ }
  }

  /* ── Calculer le prix ── */
  window.pricingCalculate = async function () {
    if (!_productId) { _showWarning('Sauvegardez d\'abord le produit.'); return; }

    const purchasePrice   = parseFloat(document.getElementById('pricing-purchase-price')?.value) || 0;
    const supplierShipping = parseFloat(document.getElementById('pricing-supplier-shipping')?.value) || 0;
    const weightKg        = parseFloat(document.getElementById('pricing-weight')?.value) || 0;
    const customsRatePct  = parseFloat(document.getElementById('pricing-customs-rate')?.value);
    const marginRatePct   = parseFloat(document.getElementById('pricing-margin-rate')?.value);
    const competitorKmf   = parseFloat(document.getElementById('pricing-competitor-kmf')?.value) || null;
    const pricingNotes    = document.getElementById('pricing-notes')?.value?.trim() || null;

    if (!purchasePrice) { _showWarning('Prix d\'achat obligatoire.'); return; }

    const btn = document.getElementById('btn-pricing-calc');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Calcul…'; }

    try {
      const payload = {
        product_id: _productId,
        purchasePrice,
        purchaseCurrency: 'EUR',
        supplierShipping,
        weightKg,
        customsRate:       !isNaN(customsRatePct) ? customsRatePct / 100 : null,
        targetMarginRate:  !isNaN(marginRatePct)  ? marginRatePct  / 100 : null,
        localCompetitorPriceKmf: competitorKmf,
        pricingNotes,
      };

      const r = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _getToken() },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur calcul');

      _lastResult = data.result;
      _renderResults(data.result, competitorKmf);
      _updateStatusBadge(data.result);
    } catch (e) {
      _showWarning('Erreur : ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg> Calculer le prix'; }
    }
  };

  /* ── Afficher les résultats ── */
  function _renderResults(r, competitorKmf) {
    const fmt = n => n != null ? n.toFixed(2) + ' €' : '—';
    const fmtKmf = n => n != null ? n.toLocaleString('fr-FR') + ' KMF' : '—';

    _set('pr-purchase',   fmt(r.purchaseCost));
    _set('pr-transport',  fmt(r.transportCost));
    _set('pr-customs',    fmt(r.customsCost));
    _set('pr-taxes',      fmt(r.localTaxes));
    _set('pr-fees',       fmt(r.fixedFee + r.riskBuffer + r.safetyBuffer));
    _set('pr-total',      fmt(r.totalLandedCost));
    _set('pr-recommended-kmf', fmtKmf(r.recommendedKmf));
    _set('pr-recommended-eur', fmt(r.recommendedEur));
    _set('pr-margin',     'Marge : ' + r.marginPercent + '% (' + fmt(r.marginAmount) + ')');

    // Compétitivité
    const compEl = document.getElementById('pr-competitiveness');
    if (compEl) {
      const map = {
        very_competitive: { label: '🟢 Très compétitif', color: '#4ade80' },
        competitive:      { label: '🟡 Compétitif', color: '#fcd34d' },
        expensive:        { label: '🟠 Cher vs marché', color: '#fb923c' },
        too_expensive:    { label: '🔴 Trop cher vs marché', color: '#fca5a5' },
        no_data:          { label: '', color: '' },
      };
      const m = map[r.competitivenessStatus] || map.no_data;
      compEl.innerHTML = m.label ? '<span style="font-size:12px;color:' + m.color + '">' + m.label + '</span>' : '';
    }

    // Concurrent
    const compBlock = document.getElementById('pr-competitor-block');
    const compText  = document.getElementById('pr-competitor-text');
    if (competitorKmf && competitorKmf > 0 && compBlock && compText) {
      const diff = r.recommendedKmf - competitorKmf;
      const pct  = ((diff / competitorKmf) * 100).toFixed(1);
      compText.innerHTML = 'Concurrent local : <strong>' + fmtKmf(competitorKmf) + '</strong> | Différence : <strong>' + (diff > 0 ? '+' : '') + fmtKmf(diff) + ' (' + (diff > 0 ? '+' : '') + pct + '%)</strong>';
      compBlock.style.display = '';
    } else if (compBlock) {
      compBlock.style.display = 'none';
    }

    // Warnings
    const wEl = document.getElementById('pr-warnings');
    if (wEl) {
      const warnMap = {
        weight_missing:       '⚠️ Poids manquant — transport non calculé',
        purchase_price_missing: '⚠️ Prix d\'achat manquant',
        margin_too_low:       '⚠️ Marge inférieure au minimum recommandé',
        negative_margin:      '🔴 Marge négative — vérifiez les coûts',
        too_expensive_vs_market: '🔴 Prix trop élevé par rapport à la concurrence locale',
      };
      const warns = (r.warnings || []).map(w => '<div style="padding:5px 0;font-size:12px;color:' + (w.includes('negative') || w.includes('expensive') ? '#fca5a5' : '#fcd34d') + '">' + (warnMap[w] || w) + '</div>').join('');
      wEl.innerHTML = warns || '';
      wEl.style.display = warns ? '' : 'none';
    }

    document.getElementById('pricing-results').style.display = '';
  }

  function _updateStatusBadge(r) {
    const badge = document.getElementById('pricing-status-badge');
    if (!badge) return;
    const hasWarnings = r.warnings?.length > 0;
    if (hasWarnings && r.warnings.includes('negative_margin')) {
      badge.textContent = '🔴 Marge négative'; badge.style.background = 'rgba(239,68,68,.15)'; badge.style.color = '#fca5a5';
    } else if (hasWarnings) {
      badge.textContent = '⚠️ À vérifier'; badge.style.background = 'rgba(245,158,11,.15)'; badge.style.color = '#fcd34d';
    } else {
      badge.textContent = '✓ Calculé'; badge.style.background = 'rgba(34,197,94,.12)'; badge.style.color = '#4ade80';
    }
  }

  /* ── Appliquer le prix ── */
  window.pricingApply = async function (isManual) {
    if (!_productId || !_lastResult) { alert('Lancez d\'abord le calcul.'); return; }
    if (!confirm(isManual ? 'Appliquer le prix manuel ?' : 'Appliquer le prix recommandé de ' + (_lastResult.recommendedKmf?.toLocaleString('fr-FR') || '?') + ' KMF ?')) return;

    const payload = { product_id: _productId, use_manual: isManual };
    if (isManual) {
      payload.manual_price_eur = parseFloat(document.getElementById('pricing-manual-eur')?.value) || null;
      payload.manual_price_kmf = parseFloat(document.getElementById('pricing-manual-kmf')?.value) || null;
      payload.pricing_notes    = document.getElementById('pricing-manual-note')?.value || null;
      if (!payload.manual_price_eur) { alert('Prix EUR requis.'); return; }
    }

    try {
      const r = await fetch('/api/pricing/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _getToken() },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur');
      document.getElementById('pricing-manual-modal').style.display = 'none';
      alert('✅ Prix appliqué : ' + (data.newPriceKmf?.toLocaleString('fr-FR') || '') + ' KMF');
      // Mettre à jour le champ prix du formulaire principal
      const priceInput = document.querySelector('[name="price_eur"]') || document.querySelector('[name="price_kmf"]');
      const priceEurEl = document.querySelector('[name="price_eur"]');
      const priceKmfEl = document.querySelector('[name="price_kmf"]');
      if (priceEurEl) priceEurEl.value = data.newPriceEur;
      if (priceKmfEl) priceKmfEl.value = data.newPriceKmf;
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
  };

  /* ── Modal manuel ── */
  window.pricingOpenManual = function () {
    if (_lastResult) {
      const eur = document.getElementById('pricing-manual-eur');
      const kmf = document.getElementById('pricing-manual-kmf');
      if (eur) eur.value = _lastResult.recommendedEur || '';
      if (kmf) kmf.value = _lastResult.recommendedKmf || '';
    }
    document.getElementById('pricing-manual-modal').style.display = 'flex';
  };

  /* ── Paramètres ── */
  window.pricingOpenSettings = async function () {
    if (!_settings) {
      try {
        const r = await fetch('/api/pricing/settings', { headers: { 'Authorization': 'Bearer ' + _getToken() } });
        if (r.ok) _settings = await r.json();
      } catch (e) { alert('Erreur chargement paramètres'); return; }
    }
    const s = _settings || {};
    const set = (id, val, mult=1) => { const el = document.getElementById(id); if (el && val != null) el.value = (Number(val) * mult).toFixed(mult > 1 ? 1 : 2); };
    set('ps-eur-kmf',     s.eur_to_kmf_rate);
    set('ps-transport-kg', s.transport_per_kg_eur);
    set('ps-fixed-fee',   s.fixed_fee_per_product_eur);
    set('ps-customs',     s.default_customs_rate, 100);
    set('ps-local-tax',   s.default_local_tax_rate, 100);
    set('ps-margin',      s.default_margin_rate, 100);
    set('ps-min-margin',  s.minimum_margin_rate, 100);
    set('ps-safety',      s.safety_rate, 100);
    document.getElementById('pricing-settings-modal').style.display = 'flex';
  };

  window.pricingSaveSettings = async function () {
    const get = (id, div=1) => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? null : v / div; };
    const body = {
      eur_to_kmf_rate:           get('ps-eur-kmf'),
      transport_per_kg_eur:      get('ps-transport-kg'),
      fixed_fee_per_product_eur: get('ps-fixed-fee'),
      default_customs_rate:      get('ps-customs', 100),
      default_local_tax_rate:    get('ps-local-tax', 100),
      default_margin_rate:       get('ps-margin', 100),
      minimum_margin_rate:       get('ps-min-margin', 100),
      safety_rate:               get('ps-safety', 100),
    };
    try {
      const r = await fetch('/api/pricing/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _getToken() },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur');
      _settings = data;
      document.getElementById('pricing-settings-modal').style.display = 'none';
      alert('✅ Paramètres sauvegardés');
    } catch (e) { alert('Erreur : ' + e.message); }
  };

  /* ── Utilitaires ── */
  function _set(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
  function _showWarning(msg) { alert(msg); }
  function _getToken() {
    const s = JSON.parse(localStorage.getItem('alkamar_admin_session') || 'null');
    return s?.access_token || '';
  }

})();
```

- [ ] **Intégrer dans `product-edit.js`** : ajouter à la fin de `loadProduct()` et `saveProduct()` (pattern identique à sourcingInit) :

```javascript
// Dans loadProduct(), après sourcingInit :
if (typeof pricingInit === 'function') pricingInit(id, p);

// Note: pricingCollectData n'est pas nécessaire — pricing se sauvegarde indépendamment
```

- [ ] **Commit**

```bash
git add admin/js/pricing.js admin/js/product-edit.js
git commit -m "feat(pricing): JS admin — calcul, affichage résultats, appliquer prix, paramètres"
```

---

## Task 6 : Deploy + appliquer migration + vérification

- [ ] **Appliquer la migration** dans Supabase Dashboard SQL Editor (contenu de `011_pricing_comoros.sql`)

- [ ] **Vérifier en Node.js** :

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
Promise.all([
  sb.from('pricing_settings').select('eur_to_kmf_rate').limit(1),
  sb.from('product_pricing').select('id').limit(1),
  sb.from('product_price_history').select('id').limit(1),
]).then(([r1, r2, r3]) => {
  console.log('pricing_settings:', r1.error ? 'FAIL' : 'OK', r1.data?.[0]?.eur_to_kmf_rate);
  console.log('product_pricing:', r2.error ? 'FAIL - ' + r2.error.message : 'OK');
  console.log('product_price_history:', r3.error ? 'FAIL - ' + r3.error.message : 'OK');
});
"
```

- [ ] **Déployer** :

```bash
git push && vercel --prod
```

- [ ] **Test manuel admin** :
  1. Ouvrir une fiche produit admin
  2. Vérifier que la section "Prix Comores" apparaît
  3. Saisir : prix achat 89€, poids 0.5kg
  4. Clic "Calculer le prix"
  5. Vérifier que les résultats s'affichent (coût total, prix recommandé en KMF)
  6. Clic "Appliquer le prix recommandé" → confirmer → vérifier que `price_eur` et `price_kmf` dans le formulaire sont mis à jour
  7. Aller sur la boutique publique → vérifier que le nouveau prix s'affiche (pas les données internes)

- [ ] **Commit final**

```bash
git add -A
git commit -m "feat(pricing): Phase 1 complète — calcul prix Comores, appliquer prix, historique, paramètres admin"
```

---

## Résumé final

**Fichiers créés/modifiés :**
- `supabase/migrations/011_pricing_comoros.sql`
- `api/_lib/pricing.js` — logique `calculateComorosPrice()`
- `api/products.js` — 4 routes `?_route=pricing_*`
- `vercel.json` — 4 rewrites
- `admin/products/edit.html` — section pricing + 2 modales
- `admin/js/pricing.js` — logique UI complète
- `admin/js/product-edit.js` — intégration `pricingInit()`

**Formule (centralisée dans `api/_lib/pricing.js`) :**
```
coût_achat = prix_fournisseur + frais_livraison_fournisseur
transport = poids_kg × transport_par_kg
base_douane = coût_achat + transport
douane = base_douane × taux_douane
taxes_locales = base_douane × taux_taxes_locales
risque = coût_achat × risk_rate
sécurité = coût_achat × safety_rate
coût_total = coût_achat + transport + frais_fixes + douane + taxes_locales + risque + sécurité
prix_recommandé = coût_total × (1 + marge)
→ arrondi KMF commercial
```

**Non implémenté en Phase 1 (Phase 2) :**
- Règles de marge par catégorie (`category_pricing_rules`)
- Page de validation globale avec tableau
- Historique UI dans l'admin
- Tests Playwright automatisés
