// js/checkout.js — Logique checkout invité
'use strict';

(function () {
  var _delivery = 'pickup';
  var _payment  = 'stripe';
  var _items    = [];

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', function () {
    _items = (typeof Cart !== 'undefined') ? Cart.load() : [];
    if (!_items.length) { window.location.href = 'index.html'; return; }
    renderSummary();
  });

  /* ── Sélection livraison ── */
  window.setDelivery = function (method) {
    _delivery = method;
    document.querySelectorAll('.opt-card[id^="card-pickup"], .opt-card[id="card-home"]').forEach(function (c) { c.classList.remove('is-selected'); });
    var cardId = method === 'pickup' ? 'card-pickup' : 'card-home';
    document.getElementById(cardId).classList.add('is-selected');
    document.getElementById(method === 'pickup' ? 'r-pickup' : 'r-home').checked = true;
    document.getElementById('delivery-extra').style.display = method === 'home_delivery' ? '' : 'none';
    var cashTitle = document.getElementById('cash-title');
    if (cashTitle) cashTitle.textContent = method === 'home_delivery' ? '💵 Espèces à la livraison' : '💵 Espèces au retrait';
    var rCash = document.getElementById('r-cash');
    if (rCash) rCash.value = method === 'home_delivery' ? 'cash_delivery' : 'cash_pickup';
    if (_payment === 'cash_pickup' || _payment === 'cash_delivery') {
      _payment = method === 'home_delivery' ? 'cash_delivery' : 'cash_pickup';
    }
    document.getElementById('delivery-label').textContent = method === 'home_delivery' ? 'Livraison à domicile' : 'Retrait boutique';
    renderSummary();
  };

  /* ── Sélection paiement ── */
  window.setPayment = function (method) {
    _payment = method;
    ['stripe','mobile','cash'].forEach(function (k) {
      var c = document.getElementById('card-' + k);
      if (c) c.classList.remove('is-selected');
    });
    var mapKey = { stripe: 'stripe', mobile_money: 'mobile', cash_pickup: 'cash', cash_delivery: 'cash' };
    var card = document.getElementById('card-' + mapKey[method]);
    if (card) card.classList.add('is-selected');
    var mapRadio = { stripe: 'r-stripe', mobile_money: 'r-mobile', cash_pickup: 'r-cash', cash_delivery: 'r-cash' };
    var radio = document.getElementById(mapRadio[method]);
    if (radio) { radio.checked = true; radio.value = method; }
    var mmInfo = document.getElementById('mm-info');
    if (mmInfo) mmInfo.style.display = method === 'mobile_money' ? '' : 'none';
  };

  /* ── Rendu résumé ── */
  function renderSummary() {
    var fee      = _delivery === 'home_delivery' ? 5 : 0;
    var subtotal = _items.reduce(function (s, i) { return s + (i.price_eur || 0) * (i.qty || 1); }, 0);
    var total    = subtotal + fee;
    var fmt      = function (n) { return n.toFixed(2).replace('.', ',') + ' €'; };

    var lines = document.getElementById('co-cart-lines');
    if (lines) {
      lines.innerHTML = _items.map(function (i) {
        var lt = ((i.price_eur || 0) * (i.qty || 1)).toFixed(2).replace('.', ',');
        return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid #f1f5f9">' +
          '<span>' + esc(i.name || '') + ' ×' + (i.qty || 1) + '</span>' +
          '<span style="font-weight:600">' + lt + ' €</span></div>';
      }).join('');
    }
    setText('co-subtotal', fmt(subtotal));
    setText('co-delivery',  fee === 0 ? 'Gratuit' : '+' + fmt(fee));
    setText('co-total',     fmt(total));
  }

  /* ── Validation ── */
  function validate() {
    var ok = true;

    var name = val('co-name');
    setError('f-name', name.length < 2);
    if (name.length < 2) ok = false;

    var email = val('co-email');
    var emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setError('f-email', !!(email && !emailOk));
    if (email && !emailOk) ok = false;

    var wa = val('co-wa').replace(/\s+/g, '');
    var waOk = !wa || /^\+?\d{7,15}$/.test(wa);
    setError('f-wa', !!(wa && !waOk));
    if (wa && !waOk) ok = false;

    var contactOk = (email && emailOk) || (wa && waOk);
    var errC = document.getElementById('err-contact');
    if (errC) errC.style.display = contactOk ? 'none' : '';
    if (!contactOk) ok = false;

    return ok;
  }

  function setError(id, has) {
    var f = document.getElementById(id);
    if (!f) return;
    if (has) f.classList.add('is-error');
    else     f.classList.remove('is-error');
  }

  /* ── Soumission ── */
  window.submitOrder = async function () {
    if (!validate()) return;

    var btn    = document.getElementById('co-btn');
    var errBox = document.getElementById('global-err');
    btn.disabled = true;
    btn.textContent = '⏳ Traitement…';
    errBox.style.display = 'none';

    var payload = {
      customer_name:     val('co-name'),
      customer_email:    val('co-email') || null,
      customer_whatsapp: val('co-wa').replace(/\s+/g,'') || null,
      delivery_method:   _delivery,
      delivery_city:     val('co-city') || null,
      delivery_address:  val('co-addr') || null,
      delivery_notes:    val('co-dnotes') || null,
      payment_method:    _payment,
      cart_items:        _items.map(function (i) { return { id: i.id, qty: i.qty || 1 }; }),
    };

    try {
      var r    = await fetch('/api/orders?action=guest_checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      var data = await r.json();

      if (!r.ok) {
        var msgs = (data.errors || [data.error]).filter(Boolean).join('<br>');
        errBox.innerHTML = msgs || 'Erreur serveur.';
        errBox.style.display = '';
        btn.disabled = false;
        btn.textContent = '🛒 Valider ma commande';
        return;
      }

      // Succès — vider le panier
      if (typeof Cart !== 'undefined') Cart.clear();

      if (data.mode === 'stripe' && data.url) {
        window.location.href = data.url;
      } else {
        var ps = new URLSearchParams({ order_id: data.order_id || '', order_number: data.order_number || '', mode: data.mode || _payment, total: data.total_eur || '' });
        window.location.href = 'success.html?' + ps.toString();
      }
    } catch (e) {
      errBox.textContent = 'Erreur réseau. Vérifiez votre connexion.';
      errBox.style.display = '';
      btn.disabled = false;
      btn.textContent = '🛒 Valider ma commande';
    }
  };

  /* ── Utilitaires ── */
  function val(id) { var el = document.getElementById(id); return el ? (el.value || '').trim() : ''; }
  function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
})();
