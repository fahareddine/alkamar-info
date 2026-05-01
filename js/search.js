// js/search.js — Recherche produit temps réel — Alkamar Info
(function () {
  'use strict';

  /* ── Config ──────────────────────────────────────────────────── */
  const MAX_SHOWN   = 8;
  const DEBOUNCE_MS = 200;
  const MIN_CHARS   = 2;
  const API_URL     = '/api/products?status=active&limit=500';

  /* ── État ────────────────────────────────────────────────────── */
  let _products = [];
  let _loaded   = false;
  let _timer    = null;
  let _selIdx   = -1;
  let _panel    = null;
  let _input    = null;
  let _clearBtn = null;

  /* ── Normalisation (accents, casse, alias) ───────────────────── */
  const ALIASES = {
    wifi: 'wi-fi', 'wi-fi': 'wifi', usb: 'usb',
    ordinateur: 'ordinateurs', routeur: 'routeurs',
    ecran: 'écran', 'ecrans': 'écrans',
  };

  function norm(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function tokens(q) {
    const n = norm(q);
    const t = n.split(/\s+/).filter(Boolean);
    return t.flatMap(w => ALIASES[w] ? [w, ALIASES[w]] : [w]);
  }

  /* ── Scoring ─────────────────────────────────────────────────── */
  function score(p, q) {
    const nq   = norm(q);
    const toks = tokens(q);
    const name = norm(p.name || '');
    const brand= norm(p.brand || '');
    const cat  = norm(p._cat || '');
    const sub  = norm(p._sub || '');
    const desc = norm(p.description || '');
    const feat = norm((p.features || []).join(' '));
    const specs= norm(JSON.stringify(p.specs || {}));

    let s = 0;

    // Correspondance exacte du nom
    if (name === nq)          s += 1000;
    else if (name.startsWith(nq)) s += 800;
    else if (name.includes(nq))   s += 600;

    // Marque
    if (brand === nq)         s += 500;
    else if (brand.includes(nq)) s += 350;

    // Catégorie
    if (cat.includes(nq))     s += 200;
    if (sub.includes(nq))     s += 180;

    // Multi-tokens : tous doivent matcher
    if (toks.length > 1) {
      const all = name + ' ' + brand + ' ' + cat + ' ' + desc;
      if (toks.every(t => all.includes(t))) s += 100;
    }

    // Description + features + specs
    if (desc.includes(nq))    s += 60;
    if (feat.includes(nq))    s += 50;
    if (specs.includes(nq))   s += 30;

    return s;
  }

  function search(q) {
    if (!q || q.length < MIN_CHARS) return [];
    return _products
      .map(p => ({ p, s: score(p, q) }))
      .filter(r => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(r => r.p);
  }

  /* ── Highlight ───────────────────────────────────────────────── */
  function hl(text, q) {
    if (!text) return '';
    const nText = norm(text);
    const nQ    = norm(q);
    const idx   = nText.indexOf(nQ);
    if (idx < 0) return esc(text);
    return esc(text.slice(0, idx))
      + `<mark class="sh">${esc(text.slice(idx, idx + q.length))}</mark>`
      + esc(text.slice(idx + q.length));
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Rendu panel ─────────────────────────────────────────────── */
  function itemHTML(p, q) {
    const img   = p.main_image_url || p.image || '';
    const price = p.price_eur
      ? Number(p.price_eur).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
      : '';
    const cat   = esc(p._cat || '');
    const link  = 'produit.html?id=' + (p.legacy_id || p.id);
    const stkCls= p.stock_class === 'out-stock' ? ' sp-stock--out' : '';

    return `<a href="${link}" class="sp-item" tabindex="-1">
      <div class="sp-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}</div>
      <div class="sp-info">
        <div class="sp-name">${hl(p.name || '', q)}</div>
        <div class="sp-meta">
          ${cat ? `<span class="sp-cat">${cat}</span>` : ''}
          ${p.stock_label ? `<span class="sp-stock${stkCls}">${esc(p.stock_label)}</span>` : ''}
        </div>
      </div>
      ${price ? `<div class="sp-price">${price}</div>` : ''}
    </a>`;
  }

  function renderInto(q, panelEl) {
    if (!panelEl) return;
    if (!q || q.length < MIN_CHARS) { panelEl.style.display = 'none'; return; }

    if (!_loaded) {
      panelEl.innerHTML = '<div class="sp-empty"><p>Chargement…</p></div>';
      panelEl.style.display = 'block';
      return;
    }

    const results = search(q);

    if (!results.length) {
      panelEl.innerHTML = `<div class="sp-empty">
        <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" width="36" height="36"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <p>Aucun résultat pour <strong>"${esc(q)}"</strong></p>
        <span>Essayez un autre mot-clé</span>
      </div>`;
      panelEl.style.display = 'block';
      return;
    }

    const shown   = results.slice(0, MAX_SHOWN);
    const hasMore = results.length > MAX_SHOWN;

    const footer = hasMore
      ? `<a href="index.html?q=${encodeURIComponent(q)}" class="sp-more">
           Voir les ${results.length} résultats
           <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"/></svg>
         </a>`
      : '';

    panelEl.innerHTML = `<div class="sp-list">${shown.map(p => itemHTML(p, q)).join('')}</div>${footer}`;
    panelEl.style.display = 'block';
  }

  /* ── Panel desktop ───────────────────────────────────────────── */
  function showPanel(q) { renderInto(q, _panel); _selIdx = -1; }
  function hidePanel()  { if (_panel) { _panel.style.display = 'none'; _selIdx = -1; } }

  /* ── Navigation clavier (desktop) ───────────────────────────── */
  function onKey(e) {
    if (!_panel || _panel.style.display === 'none') return;
    const items = [..._panel.querySelectorAll('.sp-item')];
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _selIdx = Math.min(_selIdx + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === _selIdx));
      items[_selIdx]?.scrollIntoView({ block: 'nearest' });

    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _selIdx = Math.max(_selIdx - 1, -1);
      items.forEach((el, i) => el.classList.toggle('active', i === _selIdx));

    } else if (e.key === 'Enter') {
      if (_selIdx >= 0 && items[_selIdx]) { e.preventDefault(); items[_selIdx].click(); }

    } else if (e.key === 'Escape') {
      hidePanel();
      _input?.blur();
    }
  }

  /* ── Overlay mobile ──────────────────────────────────────────── */
  function buildMobileOverlay() {
    /* Bouton toggle dans header__actions */
    const actions = document.querySelector('.header__actions');
    if (!actions || document.getElementById('search-toggle-btn')) return;

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'search-toggle-btn';
    toggleBtn.className = 'header__action';
    toggleBtn.setAttribute('aria-label', 'Rechercher');
    toggleBtn.innerHTML = `
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="22" height="22"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <span>Chercher</span>`;
    const menuToggle = document.getElementById('menu-toggle-btn');
    actions.insertBefore(toggleBtn, menuToggle);

    /* Overlay */
    const overlay = document.createElement('div');
    overlay.id = 'mso';
    overlay.innerHTML = `
      <div class="mso-box">
        <div class="mso-bar">
          <svg class="mso-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="17" height="17"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input id="mso-input" type="text" placeholder="Rechercher un produit, une marque…" autocomplete="off" autocorrect="off">
          <button id="mso-clear" aria-label="Effacer" style="display:none">✕</button>
          <button id="mso-close" aria-label="Fermer">Annuler</button>
        </div>
        <div id="mso-panel" class="search-panel" style="display:none"></div>
      </div>`;
    document.body.appendChild(overlay);

    const mInput = document.getElementById('mso-input');
    const mPanel = document.getElementById('mso-panel');
    const mClear = document.getElementById('mso-clear');
    const mClose = document.getElementById('mso-close');

    /* Ouvrir */
    toggleBtn.addEventListener('click', () => {
      overlay.classList.add('active');
      setTimeout(() => mInput?.focus(), 80);
    });

    /* Fermer */
    function closeMso() { overlay.classList.remove('active'); mInput.value = ''; mClear.style.display = 'none'; mPanel.style.display = 'none'; }
    mClose.addEventListener('click', closeMso);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeMso(); });

    /* Clear */
    mClear.addEventListener('click', () => { mInput.value = ''; mClear.style.display = 'none'; mPanel.style.display = 'none'; mInput.focus(); });

    /* Input */
    mInput.addEventListener('input', function () {
      const q = this.value.trim();
      mClear.style.display = q ? 'flex' : 'none';
      clearTimeout(_timer);
      _timer = setTimeout(() => renderInto(q, mPanel), DEBOUNCE_MS);
    });

    mInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeMso();
      if (e.key === 'Enter') {
        const q = mInput.value.trim();
        if (q) window.location.href = 'index.html?q=' + encodeURIComponent(q);
      }
    });
  }

  /* ── Chargement produits ─────────────────────────────────────── */
  async function loadProducts() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) return;
      const data = await res.json();
      _products = data.map(p => ({
        ...p,
        _cat: p.categories?.name || '',
        _sub: p.categories?.slug || '',
      }));
      _loaded = true;
    } catch (e) {
      console.warn('[search] Erreur chargement:', e.message);
    }
  }

  /* ── Init desktop ────────────────────────────────────────────── */
  function init() {
    _input = document.getElementById('search-input') || document.getElementById('searchInput');
    if (!_input) return;

    const wrapper = _input.closest('.search-bar');
    if (!wrapper) return;

    wrapper.classList.add('search-bar--enhanced');

    /* Clear button */
    _clearBtn = document.createElement('button');
    _clearBtn.className = 'search-bar__clear';
    _clearBtn.innerHTML = '✕';
    _clearBtn.setAttribute('aria-label', 'Effacer');
    _clearBtn.style.display = 'none';
    _input.insertAdjacentElement('afterend', _clearBtn);

    _clearBtn.addEventListener('click', () => {
      _input.value = '';
      _clearBtn.style.display = 'none';
      hidePanel();
      _input.focus();
      if (typeof window.sidebarSearch === 'function') window.sidebarSearch('');
    });

    /* Panel */
    _panel = document.createElement('div');
    _panel.className = 'search-panel';
    _panel.style.display = 'none';
    wrapper.appendChild(_panel);

    /* Événements */
    _input.addEventListener('input', function () {
      const q = this.value.trim();
      _clearBtn.style.display = q ? 'flex' : 'none';
      clearTimeout(_timer);
      _timer = setTimeout(() => showPanel(q), DEBOUNCE_MS);
    });

    _input.addEventListener('focus', function () {
      const q = this.value.trim();
      if (q.length >= MIN_CHARS) showPanel(q);
    });

    _input.addEventListener('keydown', onKey);

    /* Fermer au clic extérieur */
    document.addEventListener('click', e => {
      if (!wrapper.contains(e.target)) hidePanel();
    });

    /* Paramètre URL ?q= */
    const urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ && _input) {
      _input.value = urlQ;
      _clearBtn.style.display = 'flex';
    }

    /* Mobile overlay */
    buildMobileOverlay();

    /* Chargement produits */
    loadProducts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
