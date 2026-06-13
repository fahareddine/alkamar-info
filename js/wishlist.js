/* ── Wishlist — Alkamar Info ──────────────────────────────── */
(function () {
  'use strict';

  var KEY = 'alkamar_wish';
  var _listeners = [];
  var _toastTimer = null;

  /* ── Lecture / écriture localStorage ─────────────────────── */

  function _read() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      // Migration : ancien format string[] → object[]
      return raw.map(function (item) {
        return typeof item === 'string' ? { id: item } : item;
      });
    } catch (e) {
      return [];
    }
  }

  function _write(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      // Storage plein ou bloqué — ignorer silencieusement
    }
  }

  /* ── API publique ─────────────────────────────────────────── */

  function getList() {
    return _read();
  }

  function getCount() {
    return _read().length;
  }

  function has(id) {
    return _read().some(function (item) { return item.id === id; });
  }

  function toggle(id, productData) {
    var list = _read();
    var idx = list.findIndex(function (item) { return item.id === id; });
    var added;

    if (idx === -1) {
      // Ajout : on fusionne l'id avec les données produit fournies
      var entry = Object.assign({ id: id }, productData || {});
      list.push(entry);
      added = true;
      _showToast('Ajouté aux favoris ♡ ', true);
    } else {
      list.splice(idx, 1);
      added = false;
      _showToast('Retiré des favoris');
    }

    _write(list);
    _emit();
    return { added: added };
  }

  function clear() {
    _write([]);
    _emit();
    _showToast('Favoris vidés');
  }

  /* ── Toast ────────────────────────────────────────────────── */

  function _showToast(msg, withLink) {
    var toast = document.getElementById('wish-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'wish-toast';
      toast.className = 'wish-toast';
      document.body.appendChild(toast);
    }

    toast.textContent = msg;
    if (withLink) {
      var link = document.createElement('a');
      link.href = 'favoris.html';
      link.textContent = 'Voir mes favoris →';
      toast.appendChild(link);
    }
    toast.classList.toggle('wish-toast--link', !!withLink);
    toast.classList.add('wish-toast--visible');

    if (_toastTimer) {
      clearTimeout(_toastTimer);
    }
    // Laisse plus de temps quand il y a un lien à cliquer
    _toastTimer = setTimeout(function () {
      toast.classList.remove('wish-toast--visible');
      _toastTimer = null;
    }, withLink ? 4000 : 2200);
  }

  /* ── Listeners ────────────────────────────────────────────── */

  function on(cb) {
    _listeners.push(cb);
  }

  function _emit() {
    var count = getCount();
    _listeners.forEach(function (cb) { cb(count); });
  }

  /* ── Badge navigation ─────────────────────────────────────── */

  function _updateNavBadge() {
    var count = getCount();

    // Cœur du header : rouge plein quand au moins 1 favori (retour visuel clair
    // pour le client — il voit que son ajout a fonctionné). Gris/contour si vide.
    var wishLink = document.querySelector('.header__action--wishlist');
    if (wishLink && !wishLink.hasAttribute('aria-current')) {
      var svg = wishLink.querySelector('svg');
      if (svg) {
        svg.setAttribute('fill', count > 0 ? '#ef4444' : 'none');
        svg.setAttribute('stroke', count > 0 ? '#ef4444' : 'currentColor');
      }
    }

    var badge = document.getElementById('wish-badge');
    if (!badge) return;
    var prev = badge.textContent;
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
    // Animation « bump » quand le compteur change → le client perçoit le +1.
    // La classe est RETIRÉE après l'anim (sinon le scale 1.5 reste figé = badge gonflé).
    if (count > 0 && String(count) !== prev) {
      badge.classList.remove('bump');
      void badge.offsetWidth; // reflow pour rejouer l'animation
      badge.classList.add('bump');
      setTimeout(function () { badge.classList.remove('bump'); }, 250);
    }
  }

  function _initNavBadge() {
    // Trouve le lien header__action dont le <span> contient exactement "Favoris"
    var actions = document.querySelectorAll('a.header__action');
    var wishLink = null;

    for (var i = 0; i < actions.length; i++) {
      var spans = actions[i].querySelectorAll('span');
      for (var j = 0; j < spans.length; j++) {
        if (spans[j].textContent.trim() === 'Favoris') {
          wishLink = actions[i];
          break;
        }
      }
      if (wishLink) break;
    }

    if (!wishLink) return;

    if (wishLink.getAttribute('href') !== 'favoris.html') {
      wishLink.href = 'favoris.html';
    }

    // Classe CSS pour rendre le cœur visible aussi sur mobile (cf. style.css)
    wishLink.classList.add('header__action--wishlist');

    // Crée le badge s'il n'existe pas déjà
    var badge = document.getElementById('wish-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'wish-badge';
      badge.id = 'wish-badge';
      wishLink.appendChild(badge);
    }

    _updateNavBadge();
  }

  /* ── Initialisation ───────────────────────────────────────── */

  on(_updateNavBadge);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initNavBadge);
  } else {
    _initNavBadge();
  }

  /* ── Resync mobile ──────────────────────────────────────────
     bfcache : sur mobile, revenir sur une page la restaure depuis le cache
     mémoire SANS ré-exécuter le JS → le badge reste figé. pageshow.persisted
     détecte cette restauration et relit le compteur. storage : sync entre onglets. */
  window.addEventListener('pageshow', function () { _updateNavBadge(); });
  window.addEventListener('storage', function (e) { if (e.key === KEY) _emit(); });

  /* ── toggleWish global — onclick="toggleWish(this)" sur toutes les pages ── */

  window.toggleWish = function (btn) {
    var id = btn.dataset.id;
    if (!id) return;
    var card = btn.closest('.product-card');
    var productData = {
      name:       card ? ((card.querySelector('.card-title') || {}).textContent || '').trim() : '',
      brand:      card ? ((card.querySelector('.card-brand') || {}).textContent || '').trim() : '',
      price_eur:  parseFloat(((card ? (card.querySelector('.price-main') || {}) : {}).childNodes[0] || {}).textContent || '0') || 0,
      price_kmf:  parseInt(((card ? (card.querySelector('.price-kmf') || {}).textContent : '') || '0').replace(/\D/g, '')) || 0,
      img:        card ? ((card.querySelector('.card-img img') || {}).src || '') : '',
      stock:      card ? (card.querySelector('.card-stock') || {}).textContent || '' : '',
      stockClass: card ? ((card.querySelector('.card-stock') || {}).className || '').replace('card-stock', '').trim() : '',
    };
    var result = toggle(id, productData);
    var added = result.added;
    var svg = btn.querySelector('svg');
    if (svg) {
      svg.setAttribute('fill', added ? '#ef4444' : 'none');
      svg.setAttribute('stroke', added ? '#ef4444' : 'currentColor');
    }
    btn.classList.toggle('wished', added);
    btn.setAttribute('aria-label', added ? 'Retirer des favoris' : 'Ajouter aux favoris');
  };

  /* ── Export ───────────────────────────────────────────────── */

  window.Wishlist = { toggle: toggle, clear: clear, getList: getList, getCount: getCount, has: has, on: on };

}());
