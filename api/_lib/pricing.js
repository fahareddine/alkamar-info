// api/_lib/pricing.js — Logique calcul prix Comores (jamais exposé côté public)
'use strict';

/**
 * Arrondi commercial KMF :
 * < 10 000   → 500 KMF
 * 10k–50k    → 1 000 KMF
 * 50k–150k   → 2 500 KMF
 * > 150 000  → 5 000 KMF
 */
function roundKmf(kmf) {
  if (kmf < 10000)  return Math.ceil(kmf / 500)  * 500;
  if (kmf < 50000)  return Math.ceil(kmf / 1000) * 1000;
  if (kmf < 150000) return Math.ceil(kmf / 2500) * 2500;
  return Math.ceil(kmf / 5000) * 5000;
}

/**
 * Calcul du coût rendu Comores + prix de vente recommandé.
 *
 * @param {object} input
 *   - purchasePrice {number}             prix achat fournisseur
 *   - purchaseCurrency {string}          'EUR' (défaut) ou 'KMF'
 *   - supplierShipping {number}          frais livraison fournisseur (EUR)
 *   - weightKg {number}                  poids (kg)
 *   - customsRate {number|null}          taux douane (ex: 0.15 = 15%)
 *   - localTaxRate {number|null}         taux taxes locales
 *   - targetMarginRate {number|null}     marge souhaitée
 *   - riskRate {number}                  coefficient risque (défaut 0.05)
 *   - localCompetitorPriceKmf {number}   prix concurrent local (KMF)
 * @param {object} settings               ligne pricing_settings
 *
 * @returns {object} résultat complet
 */
function calculateComorosPrice(input, settings) {
  const {
    purchasePrice          = 0,
    purchaseCurrency       = 'EUR',
    supplierShipping       = 0,
    weightKg               = 0,
    customsRate            = null,
    localTaxRate           = null,
    targetMarginRate       = null,
    riskRate               = 0.05,
    localCompetitorPriceKmf = null,
  } = input || {};

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
  const pp = Number(purchasePrice) || 0;
  const wkg = Number(weightKg) || 0;

  if (!pp || pp <= 0)   warnings.push('purchase_price_missing');
  if (!wkg || wkg <= 0) warnings.push('weight_missing');

  // Conversion en EUR
  const purchaseEur = purchaseCurrency === 'KMF' ? pp / s.eur_to_kmf_rate : pp;
  const shippingEur = Number(supplierShipping) || 0;

  // Taux effectifs
  const effCustoms  = customsRate      != null ? Number(customsRate)       : s.default_customs_rate;
  const effTax      = localTaxRate     != null ? Number(localTaxRate)      : s.default_local_tax_rate;
  const effMargin   = targetMarginRate != null ? Number(targetMarginRate)  : s.default_margin_rate;
  const effRisk     = Number(riskRate) || 0.05;

  // Étapes de calcul
  const purchaseCost  = purchaseEur + shippingEur;
  const transportCost = wkg * s.transport_per_kg_eur;
  const fixedFee      = s.fixed_fee_per_product_eur;
  const baseForDuty   = purchaseCost + transportCost;
  const customsCost   = baseForDuty * effCustoms;
  const localTaxes    = baseForDuty * effTax;
  const riskBuffer    = purchaseCost * effRisk;
  const safetyBuffer  = purchaseCost * s.safety_rate;

  const totalLandedCost = purchaseCost + transportCost + fixedFee + customsCost + localTaxes + riskBuffer + safetyBuffer;

  // Prix recommandé
  const recEurRaw = totalLandedCost * (1 + effMargin);
  const recKmfRaw = recEurRaw * s.eur_to_kmf_rate;
  const recKmf    = roundKmf(recKmfRaw);
  const recEur    = Number((recKmf / s.eur_to_kmf_rate).toFixed(2));

  // Marge réelle
  const marginAmount = recEur - totalLandedCost;
  const marginRate   = totalLandedCost > 0 ? marginAmount / totalLandedCost : 0;
  const marginPct    = Number((marginRate * 100).toFixed(1));

  // Compétitivité
  let competitivenessStatus = 'no_data';
  const compKmf = Number(localCompetitorPriceKmf) || 0;
  if (compKmf > 0) {
    const ratio = recKmf / compKmf;
    if (ratio <= 0.9)       competitivenessStatus = 'very_competitive';
    else if (ratio <= 1.05) competitivenessStatus = 'competitive';
    else if (ratio <= 1.2)  competitivenessStatus = 'expensive';
    else                    competitivenessStatus = 'too_expensive';
  }

  if (marginRate < s.minimum_margin_rate)            warnings.push('margin_too_low');
  if (marginRate < 0)                                warnings.push('negative_margin');
  if (competitivenessStatus === 'too_expensive')     warnings.push('too_expensive_vs_market');

  const n2 = v => Number(v.toFixed(2));

  return {
    purchaseCost:   n2(purchaseCost),
    transportCost:  n2(transportCost),
    fixedFee:       n2(fixedFee),
    customsCost:    n2(customsCost),
    localTaxes:     n2(localTaxes),
    riskBuffer:     n2(riskBuffer),
    safetyBuffer:   n2(safetyBuffer),
    totalLandedCost: n2(totalLandedCost),
    recommendedEurRaw: n2(recEurRaw),
    recommendedKmfRaw: Math.round(recKmfRaw),
    recommendedEur: recEur,
    recommendedKmf: recKmf,
    marginAmount:   n2(marginAmount),
    marginRate:     Number(marginRate.toFixed(4)),
    marginPercent:  marginPct,
    effCustomsRate: effCustoms,
    effLocalTaxRate: effTax,
    effMarginRate:  effMargin,
    effRiskRate:    effRisk,
    eurToKmfRate:   s.eur_to_kmf_rate,
    competitivenessStatus,
    warnings,
  };
}

module.exports = { calculateComorosPrice, roundKmf };
