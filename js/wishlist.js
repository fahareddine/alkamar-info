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
      _showToast('Ajouté aux favoris ♡');
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

  function _showToast(msg) {
    var toast = document.getElementById('wish-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'wish-toast';
      toast.className = 'wish-toast';
      document.body.appendChild(toast);
    }

    toast.textContent = msg;
    toast.classList.add('wish-toast--visible');

    if (_toastTimer) {
      clearTimeout(_toastTimer);
    }
    _toastTimer = setTimeout(function () {
      toast.classList.remove('wish-toast--visible');
      _toastTimer = null;
    }, 2200);
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
    var badge = document.getElementById('wish-badge');
    if (!badge) return;
    var count = getCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
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

  /* ── Export ───────────────────────────────────────────────── */

  window.Wishlist = { toggle: toggle, clear: clear, getList: getList, getCount: getCount, has: has, on: on };

}());
