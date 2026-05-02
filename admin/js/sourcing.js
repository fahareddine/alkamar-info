// admin/js/sourcing.js — Logique sourcing fournisseur (admin uniquement — jamais chargé côté client)
'use strict';

(function () {

  /* ── État ────────────────────────────────────────────────────────── */
  let _productId   = null;
  let _offers      = [];
  let _editOfferId = null;

  /* ── Init : appelée par product-edit.js après chargement du produit ── */
  window.sourcingInit = function (productId, productData) {
    _productId = productId;

    const fields = ['supplier_url','supplier_name','supplier_price',
                    'supplier_shipping','supplier_delivery',
                    'supplier_availability','supplier_notes'];
    fields.forEach(f => {
      const el = document.getElementById(f);
      if (el && productData[f] != null) el.value = productData[f];
    });

    _updateBuyButton();

    if (productData.supplier_last_checked) {
      const meta = document.getElementById('sourcing-meta');
      const ts   = document.getElementById('sourcing-last-checked');
      if (meta && ts) {
        ts.textContent = 'Dernière vérif : ' + new Date(productData.supplier_last_checked).toLocaleString('fr-FR');
        meta.style.display = '';
      }
    }

    document.getElementById('supplier_url')?.addEventListener('input', _updateBuyButton);
    if (productId) _loadOffers();
  };

  function _updateBuyButton() {
    const url = document.getElementById('supplier_url')?.value?.trim();
    const btn = document.getElementById('btn-acheter');
    if (btn) btn.disabled = !url;
  }

  /* ── Collecte les champs sourcing pour la sauvegarde globale du produit ── */
  window.sourcingCollectData = function () {
    return {
      supplier_url:          document.getElementById('supplier_url')?.value?.trim()   || null,
      supplier_name:         document.getElementById('supplier_name')?.value?.trim()  || null,
      supplier_price:        parseFloat(document.getElementById('supplier_price')?.value)    || null,
      supplier_shipping:     parseFloat(document.getElementById('supplier_shipping')?.value) || null,
      supplier_delivery:     document.getElementById('supplier_delivery')?.value?.trim() || null,
      supplier_availability: document.getElementById('supplier_availability')?.value  || 'unknown',
      supplier_notes:        document.getElementById('supplier_notes')?.value?.trim() || null,
    };
  };

  /* ── Bouton Acheter ── */
  window.sourcingBuyNow = function () {
    const url = document.getElementById('supplier_url')?.value?.trim();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  /* ── Charger les offres depuis l'API ── */
  async function _loadOffers() {
    if (!_productId) return;
    try {
      const data = await api.get('/api/suppliers/offers?product_id=' + _productId);
      _offers = Array.isArray(data) ? data : [];
      _renderOffers();
      const el = document.getElementById('offers-count');
      if (el) el.textContent = _offers.length;
    } catch (e) {
      console.warn('[Sourcing] Chargement offres échoué:', e.message);
    }
  }

  /* ── Rendu tableau des offres ── */
  function _renderOffers() {
    const tbody = document.getElementById('sourcing-offers-body');
    if (!tbody) return;
    if (!_offers.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:20px">Aucune offre enregistrée</td></tr>';
      return;
    }
    tbody.innerHTML = _offers.map(o => {
      const avail = { in_stock: '🟢 En stock', out_of_stock: '🔴 Rupture', unknown: '⚪ Inconnu' }[o.availability] || '⚪';
      const score = o.score != null
        ? '<span class="score-badge score-' + (o.score >= 80 ? 'high' : o.score >= 60 ? 'med' : 'low') + '">' + Math.round(o.score) + '</span>'
        : '—';
      const conf    = o.confidence ? '<span class="conf-badge">' + o.confidence + '%</span>' : '—';
      const primary = o.is_primary ? '<span class="badge badge--best" style="font-size:10px;margin-left:4px">Principal</span>' : '';
      const titleTxt = (o.title || '').substring(0, 40) + ((o.title || '').length > 40 ? '…' : '');
      return '<tr class="' + (o.is_primary ? 'sourcing-row--primary' : '') + '">'
        + '<td><strong>' + _esc(o.supplier_name) + '</strong>' + primary + '</td>'
        + '<td class="sourcing-title" title="' + _esc(o.title || '') + '">' + _esc(titleTxt) + '</td>'
        + '<td>' + (o.price ? o.price.toFixed(2) + '€' : '—') + '</td>'
        + '<td>' + (o.shipping_price != null ? (o.shipping_price > 0 ? o.shipping_price.toFixed(2) + '€' : 'Gratuit') : '—') + '</td>'
        + '<td>' + _esc(o.delivery_estimate || '—') + '</td>'
        + '<td>' + avail + '</td>'
        + '<td>' + score + '</td>'
        + '<td>' + conf + '</td>'
        + '<td class="sourcing-actions-cell">'
          + '<button class="btn btn--ghost btn--xs" onclick="window.open(\'' + _esc(o.supplier_url) + '\',\'_blank\',\'noopener\')" title="Ouvrir">↗</button>'
          + '<button class="btn btn--secondary btn--xs" onclick="sourcingSetPrimary(\'' + o.id + '\')" title="Définir principal">★</button>'
          + '<button class="btn btn--ghost btn--xs" onclick="sourcingDeleteOffer(\'' + o.id + '\')" title="Supprimer" style="color:#ef4444">🗑</button>'
        + '</td>'
        + '</tr>';
    }).join('');
  }

  /* ── Afficher/masquer le tableau des offres ── */
  window.sourcingToggleOffers = function () {
    const panel = document.getElementById('sourcing-offers-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
  };

  /* ── Recherche automatique meilleur prix via SerpAPI ── */
  window.sourcingSearch = async function () {
    if (!_productId) { _showStatus('error', 'Sauvegardez d\'abord le produit.'); return; }
    const name  = document.getElementById('name')?.value?.trim()  || '';
    const brand = document.getElementById('brand')?.value?.trim() || '';
    if (!name) { _showStatus('error', 'Nom du produit manquant.'); return; }

    _showStatus('loading', '🔍 Recherche des meilleures offres en cours…');
    const btnSearch = document.getElementById('btn-search-price');
    if (btnSearch) btnSearch.disabled = true;

    try {
      const result = await api.post('/api/suppliers/search', { name, brand });

      if (!result || !result.offers || !result.offers.length) {
        _showStatus('info', 'Aucune offre trouvée pour <strong>' + _esc(brand + ' ' + name) + '</strong>. Essayez d\'ajuster le nom du produit.');
        return;
      }

      const offers = result.offers;

      // Sauvegarder toutes les offres dans la base
      let saved = 0;
      for (const offer of offers) {
        try {
          await api.post('/api/suppliers/offers', { product_id: _productId, ...offer });
          saved++;
        } catch (e) { /* ignore doublons */ }
      }

      // Recharger les offres depuis la base
      await _loadOffers();

      // Auto-remplir la meilleure offre dans les champs si confidence >= 70
      const best = offers[0];
      if (best && best.confidence >= 70) {
        const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
        set('supplier_url',      best.supplier_url);
        set('supplier_name',     best.supplier_name);
        set('supplier_price',    best.price ?? '');
        set('supplier_shipping', best.shipping_price ?? '');
        set('supplier_delivery', best.delivery_estimate ?? '');
        set('supplier_availability', best.availability || 'unknown');
        _updateBuyButton();

        const total = (best.price || 0) + (best.shipping_price || 0);
        _showStatus('success',
          '✅ <strong>' + saved + ' offre(s) trouvée(s)</strong> pour <em>' + _esc(brand + ' ' + name) + '</em>.<br>'
          + 'Meilleure offre auto-remplie : <strong>' + _esc(best.supplier_name) + '</strong>'
          + (best.price ? ' — ' + best.price.toFixed(2) + ' €' : '')
          + (best.shipping_price === 0 ? ' · livraison gratuite' : '')
          + ' (confiance ' + best.confidence + '%).<br>'
          + '<small>N\'oubliez pas de sauvegarder le produit.</small>'
        );
      } else {
        _showStatus('info',
          '<strong>' + saved + ' offre(s) trouvée(s)</strong> pour <em>' + _esc(brand + ' ' + name) + '</em>. '
          + 'Confiance insuffisante pour l\'auto-remplissage — vérifiez le tableau et sélectionnez l\'offre souhaitée.'
        );
      }

      // Afficher le tableau
      const panel = document.getElementById('sourcing-offers-panel');
      if (panel) panel.style.display = '';

    } catch (e) {
      if (e.message && e.message.includes('SERPAPI_KEY')) {
        _showStatus('error',
          '🔑 <strong>Clé SerpAPI manquante.</strong><br>'
          + 'Ajoute <code>SERPAPI_KEY</code> dans les variables d\'environnement Vercel.<br>'
          + '<a href="https://serpapi.com" target="_blank" rel="noopener">Obtenir une clé gratuite (100 req/mois)</a>'
        );
      } else {
        _showStatus('error', 'Erreur recherche : ' + e.message);
      }
    } finally {
      if (btnSearch) btnSearch.disabled = false;
    }
  };

  /* ── Modal ajout/édition manuelle ── */
  window.sourcingAddOffer = function () {
    _editOfferId = null;
    ['modal-supplier-name','modal-supplier-url','modal-title','modal-price','modal-shipping','modal-delivery'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('modal-availability').value = 'unknown';
    document.getElementById('modal-confidence').value   = '80';
    document.getElementById('sourcing-add-modal').style.display = 'flex';
  };

  window.sourcingCloseModal = function () {
    document.getElementById('sourcing-add-modal').style.display = 'none';
  };

  window.sourcingSaveOffer = async function () {
    const name = document.getElementById('modal-supplier-name')?.value?.trim();
    const url  = document.getElementById('modal-supplier-url')?.value?.trim();
    if (!name || !url) { alert('Fournisseur et URL sont requis.'); return; }
    if (!_productId) { alert('Sauvegardez le produit avant d\'ajouter des offres.'); return; }

    const price    = parseFloat(document.getElementById('modal-price')?.value)    || null;
    const shipping = parseFloat(document.getElementById('modal-shipping')?.value) || null;
    const avail    = document.getElementById('modal-availability')?.value || 'unknown';
    const conf     = parseInt(document.getElementById('modal-confidence')?.value) || 80;

    const payload = {
      product_id:        _productId,
      supplier_name:     name,
      supplier_url:      url,
      title:             document.getElementById('modal-title')?.value?.trim() || null,
      price, shipping_price: shipping,
      delivery_estimate: document.getElementById('modal-delivery')?.value?.trim() || null,
      availability:      avail,
      confidence:        conf,
      score:             _computeScore({ price, shipping_price: shipping, availability: avail, confidence: conf }),
      source:            'manual',
    };

    try {
      if (_editOfferId) {
        await api.put('/api/suppliers/offers?offer_id=' + _editOfferId, payload);
      } else {
        await api.post('/api/suppliers/offers', payload);
      }
      sourcingCloseModal();
      await _loadOffers();
      _showStatus('success', 'Offre enregistrée.');
    } catch (e) {
      _showStatus('error', 'Erreur : ' + e.message);
    }
  };

  /* ── Définir une offre comme principale ── */
  window.sourcingSetPrimary = async function (offerId) {
    if (!_productId) return;
    const offer = _offers.find(o => o.id === offerId);
    if (!offer) return;
    if (offer.confidence < 70) {
      if (!confirm('Confiance faible (' + offer.confidence + '%). Définir quand même comme lien principal ?')) return;
    }
    try {
      await api.patch('/api/suppliers/offers?offer_id=' + offerId + '&product_id=' + _productId, {});
      // Mettre à jour les champs du formulaire principal
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
      set('supplier_url',          offer.supplier_url);
      set('supplier_name',         offer.supplier_name);
      set('supplier_price',        offer.price ?? '');
      set('supplier_shipping',     offer.shipping_price ?? '');
      set('supplier_delivery',     offer.delivery_estimate ?? '');
      set('supplier_availability', offer.availability ?? 'unknown');
      _updateBuyButton();
      await _loadOffers();
      _showStatus('success', 'Lien principal mis à jour. N\'oubliez pas de sauvegarder le produit.');
    } catch (e) {
      _showStatus('error', 'Erreur : ' + e.message);
    }
  };

  /* ── Supprimer une offre ── */
  window.sourcingDeleteOffer = async function (offerId) {
    if (!confirm('Supprimer cette offre ?')) return;
    try {
      await _apiDelete('/api/suppliers/offers?offer_id=' + offerId);
      await _loadOffers();
    } catch (e) {
      _showStatus('error', 'Erreur : ' + e.message);
    }
  };

  /* ── Score simplifié (Phase 3 raffinera) ── */
  function _computeScore({ price, shipping_price, availability, confidence }) {
    let s = 0;
    if (price && price > 0) s += 40;
    if (availability === 'in_stock') s += 20; else if (availability === 'unknown') s += 5;
    s += ((confidence || 0) / 100) * 40;
    return Math.min(100, Math.round(s));
  }

  /* ── Utilitaires ── */
  function _showStatus(type, msg) {
    const el = document.getElementById('sourcing-status');
    if (!el) return;
    el.style.display = '';
    el.className = 'sourcing-status sourcing-status--' + type;
    el.innerHTML = msg;
    if (type === 'success') setTimeout(() => { if (el) el.style.display = 'none'; }, 4000);
  }

  function _esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function _apiDelete(url) {
    // Utilise l'objet api global si disponible, sinon fetch direct
    if (typeof api !== 'undefined' && typeof api.delete === 'function') {
      return api.delete(url);
    }
    const token = typeof api !== 'undefined' && api._getToken ? api._getToken() : '';
    const r = await fetch(url, {
      method: 'DELETE',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
    });
    if (!r.ok) throw new Error(r.statusText);
  }

  // Expose api.patch si pas encore défini dans api.js
  if (typeof api !== 'undefined' && !api.patch) {
    api.patch = (url, body) => fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(api._getToken ? { 'Authorization': 'Bearer ' + api._getToken() } : {}),
      },
      body: JSON.stringify(body),
    }).then(async r => {
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || r.statusText); }
      return r.status === 204 ? null : r.json();
    });
  }

})();
