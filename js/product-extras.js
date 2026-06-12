// js/product-extras.js — Sections additionnelles page produit
// Avis clients · Produits similaires · Récemment consultés · Alerte retour en stock
// Tout est rendu après l'événement load (aucun impact LCP/CLS/TBT).
// XSS : toute valeur dynamique passe par esc() avant insertion.
'use strict';

(function () {
  var RECENT_KEY = 'alkamar_recently_viewed';
  var RECENT_MAX = 8;

  /* ── Double gate : produit chargé + page load ── */
  var _p = null;
  function whenReady(fn) {
    var done = false;
    var loaded = document.readyState === 'complete';
    var check = function () { if (_p && loaded && !done) { done = true; fn(_p); } };
    if (window._productData) _p = window._productData;
    else document.addEventListener('product:loaded', function () { _p = window._productData; check(); });
    if (!loaded) window.addEventListener('load', function () { loaded = true; check(); });
    check();
  }

  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var fmtEur = function (n) {
    var v = Number(n) || 0;
    var parts = v.toFixed(2).split('.');
    return Number(parts[0]).toLocaleString('fr-FR') + ',' + parts[1];
  };
  function stars(n) { return '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n)); }

  function section(id, title) {
    var s = document.createElement('section');
    s.id = id;
    s.style.cssText = 'max-width:1200px;margin:32px auto 0;padding:0 16px';
    var h = document.createElement('h2');
    h.style.cssText = 'font-size:1.25rem;margin:0 0 14px;color:#0f172a';
    h.textContent = title;
    s.appendChild(h);
    document.getElementById('product-content').appendChild(s);
    return s;
  }

  function miniCard(prod) {
    var img = prod.main_image_url || prod.image || '';
    var pid = prod.slug || prod.legacy_id || prod.id;
    return '<a href="produit.html?id=' + encodeURIComponent(pid) + '" style="text-decoration:none;color:inherit;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0">' +
      '<img src="' + esc(img) + '" alt="' + esc(prod.name) + '" width="140" height="105" loading="lazy" decoding="async" style="width:100%;height:105px;object-fit:contain" onerror="this.style.display=&quot;none&quot;">' +
      '<div style="font-size:13px;font-weight:600;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">' + esc(prod.name) + '</div>' +
      (Number(prod.price_eur) > 0 ? '<div style="font-size:14px;font-weight:700;color:#1e3a8a">' + fmtEur(prod.price_eur) + ' €</div>' : '') +
      '</a>';
  }

  function cardGrid(items) {
    return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">' +
      items.map(miniCard).join('') + '</div>';
  }

  /* ── 1. Récemment consultés (localStorage) ── */
  function loadRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; }
  }
  function recordVisit(p) {
    try {
      var list = loadRecent().filter(function (r) { return r.id !== p.id; });
      list.unshift({ id: p.id, slug: p.slug || p.legacy_id || p.id, name: p.name, price_eur: p.price_eur, image: p.main_image_url || p.image || '' });
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
    } catch (e) { /* stockage plein/désactivé : non bloquant */ }
  }
  function renderRecent(p) {
    var items = loadRecent().filter(function (r) { return r.id !== p.id; }).slice(0, 4)
      .map(function (r) { return { id: r.slug || r.id, slug: r.slug, name: r.name, price_eur: r.price_eur, main_image_url: r.image }; });
    if (!items.length) return;
    section('prod-recent', '🕘 Récemment consultés').insertAdjacentHTML('beforeend', cardGrid(items));
  }

  /* ── 2. Produits similaires (même catégorie, sinon même marque) ── */
  function renderSimilar(p) {
    var catId = p.categories && p.categories.id;
    fetch('/api/products?limit=100')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) {
        if (!Array.isArray(list)) list = list.products || list.data || [];
        var similar = list.filter(function (q) {
          if (q.id === p.id) return false;
          if (!(Number(q.price_eur) > 0)) return false;
          var qCat = q.categories && q.categories.id;
          return catId && qCat === catId;
        });
        if (similar.length < 4) {
          var brand = (p.brand || '').toLowerCase();
          list.forEach(function (q) {
            if (similar.length >= 8 || q.id === p.id || similar.indexOf(q) !== -1) return;
            if (brand && (q.brand || '').toLowerCase() === brand && Number(q.price_eur) > 0) similar.push(q);
          });
        }
        if (!similar.length) return;
        section('prod-similar', '💡 Vous aimerez aussi').insertAdjacentHTML('beforeend', cardGrid(similar.slice(0, 4)));
      })
      .catch(function () { /* section optionnelle */ });
  }

  /* ── 3. Avis clients ── */
  function renderReviews(p) {
    if (!/^[\da-f-]{36}$/i.test(p.id || '')) return;
    var sec = section('prod-reviews', '⭐ Avis clients');
    var box = document.createElement('div');
    sec.appendChild(box);

    fetch('/api/products?_route=reviews&product_id=' + p.id)
      .then(function (r) { return r.ok ? r.json() : { reviews: [], count: 0 }; })
      .then(function (data) {
        var html = '';
        if (data.count > 0) {
          html += '<div style="font-size:14px;margin-bottom:12px;color:#334155"><strong style="color:#f59e0b">' + stars(data.average) + '</strong> ' + esc(data.average) + '/5 · ' + esc(data.count) + ' avis vérifié' + (data.count > 1 ? 's' : '') + '</div>';
          html += data.reviews.slice(0, 10).map(function (r) {
            var d = new Date(r.created_at).toLocaleDateString('fr-FR');
            var note = Math.max(1, Math.min(5, Number(r.rating) || 1));
            return '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:10px">' +
              '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:6px">' +
              '<strong style="font-size:14px">' + esc(r.author_name) + '</strong>' +
              '<span style="font-size:12px;color:#94a3b8">' + esc(d) + '</span></div>' +
              '<div style="color:#f59e0b;font-size:13px;margin-bottom:6px">' + stars(note) + '</div>' +
              (r.comment ? '<p style="font-size:13px;color:#334155;margin:0;line-height:1.5">' + esc(r.comment) + '</p>' : '') +
              '</div>';
          }).join('');
        } else {
          html += '<p style="font-size:14px;color:#64748b">Aucun avis pour le moment. Soyez le premier à donner votre avis !</p>';
        }
        html += reviewFormHTML();
        box.insertAdjacentHTML('beforeend', html);
        bindReviewForm(p);
      })
      .catch(function () {
        var err = document.createElement('p');
        err.style.cssText = 'font-size:13px;color:#94a3b8';
        err.textContent = 'Avis indisponibles pour le moment.';
        box.appendChild(err);
      });
  }

  function reviewFormHTML() {
    return '<details style="margin-top:14px"><summary style="cursor:pointer;font-size:14px;font-weight:600;color:#1e3a8a">✍️ Donner mon avis</summary>' +
      '<form id="review-form" style="background:#f8fafc;border-radius:10px;padding:16px;margin-top:10px;display:grid;gap:10px;max-width:480px">' +
      '<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
      '<input name="author_name" required minlength="2" maxlength="60" placeholder="Votre nom *" style="padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px">' +
      '<input name="email" type="email" placeholder="Email (non publié)" style="padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px">' +
      '<select name="rating" required style="padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px">' +
      '<option value="">Note *</option><option value="5">★★★★★ Excellent</option><option value="4">★★★★☆ Très bien</option><option value="3">★★★☆☆ Bien</option><option value="2">★★☆☆☆ Moyen</option><option value="1">★☆☆☆☆ Décevant</option></select>' +
      '<textarea name="comment" maxlength="2000" rows="3" placeholder="Votre commentaire" style="padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;resize:vertical"></textarea>' +
      '<button type="submit" style="padding:10px;border:none;border-radius:8px;background:#1e3a8a;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Envoyer mon avis</button>' +
      '<div id="review-msg" style="display:none;font-size:13px"></div>' +
      '</form></details>';
  }

  function bindReviewForm(p) {
    var form = document.getElementById('review-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('review-msg');
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      var fd = new FormData(form);
      fetch('/api/products?_route=reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: p.id,
          author_name: fd.get('author_name'),
          email: fd.get('email'),
          rating: fd.get('rating'),
          comment: fd.get('comment'),
          website: fd.get('website'),
        }),
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          msg.textContent = res.ok ? '✔ ' + (res.d.message || 'Avis envoyé !') : '✖ ' + (res.d.error || 'Erreur');
          msg.style.color = res.ok ? '#16a34a' : '#dc2626';
          msg.style.display = '';
          if (res.ok) form.reset();
          btn.disabled = false;
        })
        .catch(function () {
          msg.textContent = '✖ Erreur réseau, réessayez.';
          msg.style.color = '#dc2626';
          msg.style.display = '';
          btn.disabled = false;
        });
    });
  }

  /* ── 4. Alerte retour en stock ── */
  function renderStockAlert(p) {
    var stockEl = document.querySelector('.prod-stock.out-stock');
    if (!stockEl || !/^[\da-f-]{36}$/i.test(p.id || '')) return;
    stockEl.insertAdjacentHTML('afterend',
      '<form id="stock-alert-form" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
      '<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
      '<input name="email" type="email" required placeholder="Votre email" style="flex:1;min-width:180px;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px">' +
      '<button type="submit" style="padding:9px 14px;border:none;border-radius:8px;background:#1e3a8a;color:#fff;font-size:13px;font-weight:600;cursor:pointer">🔔 Prévenez-moi</button>' +
      '<div id="stock-alert-msg" style="display:none;flex-basis:100%;font-size:13px"></div>' +
      '</form>');

    document.getElementById('stock-alert-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var form = e.target;
      var msg = document.getElementById('stock-alert-msg');
      var fd = new FormData(form);
      fetch('/api/products?_route=stock_alert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: p.id, email: fd.get('email'), website: fd.get('website') }),
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          msg.textContent = res.ok ? '✔ ' + (res.d.message || 'Alerte enregistrée !') : '✖ ' + (res.d.error || 'Erreur');
          msg.style.color = res.ok ? '#16a34a' : '#dc2626';
          msg.style.display = '';
          if (res.ok) form.querySelector('input[name=email]').value = '';
        })
        .catch(function () {
          msg.textContent = '✖ Erreur réseau, réessayez.';
          msg.style.color = '#dc2626';
          msg.style.display = '';
        });
    });
  }

  /* ── Init ── */
  whenReady(function (p) {
    recordVisit(p);
    renderStockAlert(p);
    renderReviews(p);
    renderSimilar(p);
    renderRecent(p);
  });
})();
