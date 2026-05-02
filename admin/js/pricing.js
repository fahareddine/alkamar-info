// admin/js/pricing.js — Pricing Comores (admin uniquement — jamais chargé côté public)
'use strict';

(function () {
  let _productId   = null;
  let _productData = {};
  let _settings    = null;
  let _lastResult  = null;

  /* ── Init appelée par product-edit.js après chargement produit ── */
  window.pricingInit = function (productId, productData) {
    _productId   = productId;
    _productData = productData || {};
    if (!productId) return;
    _loadSettings();
    _loadExistingPricing();
  };

  async function _loadSettings() {
    try {
      const r = await fetch('/api/pricing/settings', {
        headers: { 'Authorization': 'Bearer ' + _getToken() }
      });
      if (r.ok) _settings = await r.json();
    } catch (e) { /* silencieux */ }
  }

  async function _loadExistingPricing() {
    if (!_productId) return;
    try {
      const r = await fetch('/api/pricing/get?product_id=' + _productId, {
        headers: { 'Authorization': 'Bearer ' + _getToken() }
      });
      if (!r.ok) return;
      const { pricing, history } = await r.json();

      if (pricing) {
        // Pré-remplir les champs avec les données sauvegardées
        const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
        set('pricing-purchase-price',    pricing.purchase_price);
        set('pricing-supplier-shipping', pricing.supplier_shipping_price);
        set('pricing-weight',            pricing.weight_kg);
        if (pricing.customs_rate    != null) set('pricing-customs-rate',   (pricing.customs_rate    * 100).toFixed(1));
        if (pricing.target_margin_rate != null) set('pricing-margin-rate', (pricing.target_margin_rate * 100).toFixed(0));
        set('pricing-competitor-kmf', pricing.local_competitor_price_kmf);
        set('pricing-notes',          pricing.pricing_notes);

        // Afficher les résultats si déjà calculés
        if (pricing.total_landed_cost_eur && pricing.recommended_price_kmf) {
          _lastResult = pricing.calculation_details || {
            totalLandedCost: pricing.total_landed_cost_eur,
            recommendedEur:  pricing.recommended_price_eur,
            recommendedKmf:  pricing.recommended_price_kmf,
            marginAmount:    pricing.margin_amount_eur,
            marginRate:      pricing.margin_rate,
            marginPercent:   pricing.margin_rate ? (pricing.margin_rate * 100).toFixed(1) : 0,
            competitivenessStatus: pricing.competitiveness_status || 'no_data',
            warnings: [],
          };
          _renderResults(_lastResult, pricing.local_competitor_price_kmf);
          _updateStatusBadge(_lastResult);
        }

        // Badge statut
        const badge = document.getElementById('pricing-status-badge');
        if (badge && pricing.price_status) {
          const labels = {
            pending:    ['Non calculé', 'rgba(148,163,184,.12)', 'var(--admin-muted)'],
            calculated: ['✓ Calculé',   'rgba(34,197,94,.1)',    '#4ade80'],
            validated:  ['✓ Validé',    'rgba(34,197,94,.15)',   '#4ade80'],
            manual:     ['✏ Manuel',    'rgba(245,158,11,.15)',  '#fcd34d'],
            to_verify:  ['⚠️ À vérifier','rgba(245,158,11,.12)', '#fcd34d'],
          };
          const [label, bg, color] = labels[pricing.price_status] || labels.pending;
          badge.textContent = label; badge.style.background = bg; badge.style.color = color;
        }
      }

      // Afficher l'historique
      if (history && history.length > 0) _renderHistory(history);
    } catch (e) { /* silencieux */ }
  }

  function _renderHistory(history) {
    const hist = document.getElementById('pricing-history');
    const list = document.getElementById('pricing-history-list');
    if (!hist || !list) return;
    const fmtKmf = v => v != null ? Number(v).toLocaleString('fr-FR') + ' KMF' : '—';
    const srcLabels = {
      recommended_apply_single: 'Prix recommandé appliqué',
      manual_update:            'Prix manuel',
      global_validation:        'Validation globale',
      rollback:                 'Restauration',
    };
    list.innerHTML = history.map(h => {
      const date = new Date(h.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
      return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(42,53,69,.4);gap:8px">'
        + '<span style="color:var(--admin-muted);font-size:11px">' + date + '</span>'
        + '<span style="font-size:11px">' + (srcLabels[h.source] || h.source || '—') + '</span>'
        + '<span style="font-weight:700;font-size:12px">' + fmtKmf(h.new_price_kmf) + '</span>'
        + '</div>';
    }).join('');
    hist.style.display = '';
  }

  /* ── Calculer le prix ── */
  window.pricingCalculate = async function () {
    if (!_productId) {
      alert('Sauvegardez d\'abord le produit avant de calculer le prix.');
      return;
    }

    const purchasePrice     = parseFloat(document.getElementById('pricing-purchase-price')?.value) || 0;
    const supplierShipping  = parseFloat(document.getElementById('pricing-supplier-shipping')?.value) || 0;
    const weightKg          = parseFloat(document.getElementById('pricing-weight')?.value) || 0;
    const customsRatePct    = document.getElementById('pricing-customs-rate')?.value;
    const marginRatePct     = document.getElementById('pricing-margin-rate')?.value;
    const competitorKmf     = parseFloat(document.getElementById('pricing-competitor-kmf')?.value) || null;
    const pricingNotes      = document.getElementById('pricing-notes')?.value?.trim() || null;

    if (!purchasePrice) { alert('Prix d\'achat obligatoire.'); return; }

    const btn = document.getElementById('btn-pricing-calc');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Calcul…'; }

    try {
      const payload = {
        product_id:             _productId,
        purchasePrice,
        purchaseCurrency:       'EUR',
        supplierShipping,
        weightKg,
        customsRate:            customsRatePct !== '' && !isNaN(parseFloat(customsRatePct))
                                  ? parseFloat(customsRatePct) / 100 : null,
        targetMarginRate:       marginRatePct  !== '' && !isNaN(parseFloat(marginRatePct))
                                  ? parseFloat(marginRatePct)  / 100 : null,
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
      alert('Erreur calcul : ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⚡ Calculer le prix'; }
    }
  };

  /* ── Rendu des résultats ── */
  function _renderResults(r, competitorKmf) {
    const fmt    = v => v != null ? v.toFixed(2) + ' €' : '—';
    const fmtKmf = v => v != null ? Number(v).toLocaleString('fr-FR') + ' KMF' : '—';

    _set('pr-purchase',        fmt(r.purchaseCost));
    _set('pr-transport',       fmt(r.transportCost));
    _set('pr-customs',         fmt(r.customsCost));
    _set('pr-taxes',           fmt(r.localTaxes));
    _set('pr-fees',            fmt((r.fixedFee || 0) + (r.riskBuffer || 0) + (r.safetyBuffer || 0)));
    _set('pr-total',           fmt(r.totalLandedCost));
    _set('pr-recommended-kmf', fmtKmf(r.recommendedKmf));
    _set('pr-recommended-eur', fmt(r.recommendedEur));
    _set('pr-margin',          'Marge : ' + r.marginPercent + '% (' + fmt(r.marginAmount) + ')');

    // Compétitivité
    const compEl = document.getElementById('pr-competitiveness');
    if (compEl) {
      const labels = {
        very_competitive: ['🟢 Très compétitif', '#4ade80'],
        competitive:      ['🟡 Compétitif',       '#fcd34d'],
        expensive:        ['🟠 Cher vs marché',   '#fb923c'],
        too_expensive:    ['🔴 Trop cher vs marché', '#fca5a5'],
        no_data:          ['', ''],
      };
      const [label, color] = labels[r.competitivenessStatus] || ['', ''];
      compEl.innerHTML = label
        ? '<span style="font-size:12px;color:' + color + '">' + label + '</span>'
        : '';
    }

    // Prix concurrent
    const compBlock = document.getElementById('pr-competitor-block');
    const compText  = document.getElementById('pr-competitor-text');
    if (competitorKmf && competitorKmf > 0 && compBlock && compText) {
      const diff = (r.recommendedKmf || 0) - competitorKmf;
      const pct  = ((diff / competitorKmf) * 100).toFixed(1);
      compText.innerHTML = 'Concurrent local : <strong>' + fmtKmf(competitorKmf)
        + '</strong> — différence : <strong style="color:' + (diff > 0 ? '#fca5a5' : '#4ade80') + '">'
        + (diff > 0 ? '+' : '') + fmtKmf(diff) + ' (' + (diff > 0 ? '+' : '') + pct + '%)</strong>';
      compBlock.style.display = '';
    } else if (compBlock) {
      compBlock.style.display = 'none';
    }

    // Warnings
    const wEl = document.getElementById('pr-warnings');
    if (wEl) {
      const warnMap = {
        weight_missing:          '⚠️ Poids manquant — coût transport non calculé',
        purchase_price_missing:  '⚠️ Prix d\'achat manquant',
        margin_too_low:          '⚠️ Marge inférieure au minimum recommandé',
        negative_margin:         '🔴 Marge négative — vérifiez les coûts',
        too_expensive_vs_market: '🔴 Prix recommandé supérieur au concurrent local',
      };
      const warns = (r.warnings || []).map(w => {
        const color = (w.includes('negative') || w.includes('expensive')) ? '#fca5a5' : '#fcd34d';
        return '<div style="padding:4px 0;font-size:12px;color:' + color + '">' + (warnMap[w] || w) + '</div>';
      }).join('');
      wEl.innerHTML = warns || '';
      wEl.style.display = warns ? '' : 'none';
    }

    document.getElementById('pricing-results').style.display = '';
  }

  function _updateStatusBadge(r) {
    const badge = document.getElementById('pricing-status-badge');
    if (!badge) return;
    if (r.warnings?.includes('negative_margin')) {
      badge.textContent = '🔴 Marge négative'; badge.style.background = 'rgba(239,68,68,.15)'; badge.style.color = '#fca5a5';
    } else if (r.warnings?.length) {
      badge.textContent = '⚠️ À vérifier'; badge.style.background = 'rgba(245,158,11,.15)'; badge.style.color = '#fcd34d';
    } else {
      badge.textContent = '✓ Calculé'; badge.style.background = 'rgba(34,197,94,.1)'; badge.style.color = '#4ade80';
    }
  }

  /* ── Appliquer le prix ── */
  window.pricingApply = async function (isManual) {
    if (!_productId || !_lastResult) { alert('Lancez d\'abord le calcul.'); return; }

    const recKmf = _lastResult.recommendedKmf?.toLocaleString('fr-FR') || '?';
    if (!confirm(isManual
      ? 'Appliquer le prix manuel ?'
      : 'Appliquer le prix recommandé de ' + recKmf + ' KMF ?'
    )) return;

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

      // Met à jour les champs de prix dans le formulaire principal
      const priceEurEl = document.querySelector('[name="price_eur"]');
      const priceKmfEl = document.querySelector('[name="price_kmf"]');
      if (priceEurEl) priceEurEl.value = data.newPriceEur;
      if (priceKmfEl) priceKmfEl.value = data.newPriceKmf;

      const badge = document.getElementById('pricing-status-badge');
      if (badge) { badge.textContent = '✓ Validé'; badge.style.background = 'rgba(34,197,94,.15)'; badge.style.color = '#4ade80'; }

      alert('✅ Prix appliqué : ' + (data.newPriceKmf?.toLocaleString('fr-FR') || '') + ' KMF = ' + data.newPriceEur + ' €\nN\'oubliez pas de sauvegarder le produit.');
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
  };

  /* ── Rollback — restaurer le prix précédent ── */
  window.pricingRollback = async function () {
    if (!_productId) { alert('Sauvegardez d\'abord le produit.'); return; }
    if (!confirm('Restaurer le prix précédent pour ce produit ?\nL\'état actuel sera sauvegardé dans l\'historique.')) return;
    try {
      const r = await fetch('/api/pricing/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _getToken() },
        body: JSON.stringify({ product_id: _productId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur rollback');
      // Met à jour les champs prix
      const priceEurEl = document.querySelector('[name="price_eur"]');
      const priceKmfEl = document.querySelector('[name="price_kmf"]');
      if (priceEurEl) priceEurEl.value = data.restoredEur;
      if (priceKmfEl) priceKmfEl.value = data.restoredKmf;
      alert('↩ Prix restauré : ' + (data.restoredKmf?.toLocaleString('fr-FR') || '') + ' KMF\nN\'oubliez pas de sauvegarder le produit.');
      // Recharger l'historique
      await _loadExistingPricing();
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

  /* ── Modal paramètres ── */
  window.pricingOpenSettings = async function () {
    if (!_settings) await _loadSettings();
    const s = _settings || {};
    const setVal = (id, val, mult = 1) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = Number((Number(val) * mult).toFixed(2));
    };
    setVal('ps-eur-kmf',      s.eur_to_kmf_rate);
    setVal('ps-transport-kg', s.transport_per_kg_eur);
    setVal('ps-fixed-fee',    s.fixed_fee_per_product_eur);
    setVal('ps-customs',      s.default_customs_rate, 100);
    setVal('ps-local-tax',    s.default_local_tax_rate, 100);
    setVal('ps-margin',       s.default_margin_rate, 100);
    setVal('ps-min-margin',   s.minimum_margin_rate, 100);
    setVal('ps-safety',       s.safety_rate, 100);
    document.getElementById('pricing-settings-modal').style.display = 'flex';
  };

  window.pricingSaveSettings = async function () {
    const get = (id, div = 1) => {
      const v = parseFloat(document.getElementById(id)?.value);
      return isNaN(v) ? null : v / div;
    };
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
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
  };

  /* ── Utilitaires ── */
  function _set(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function _getToken() {
    try {
      const s = JSON.parse(localStorage.getItem('alkamar_admin_session') || 'null');
      return s?.access_token || '';
    } catch { return ''; }
  }

})();
