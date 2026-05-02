// js/cro.js — Triggers CRO : urgence, rareté, social proof, best seller
(function () {
  'use strict';

  // Découpe le travail en chunks pour éviter les long tasks (> 50ms)
  function schedule(fn) {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(fn, { timeout: 2000 });
    } else {
      setTimeout(fn, 50);
    }
  }

  function processChunked(items, processFn, done) {
    let i = 0;
    function step() {
      const end = Math.min(i + 20, items.length);
      for (; i < end; i++) processFn(items[i]);
      if (i < items.length) {
        schedule(step);
      } else if (done) {
        done();
      }
    }
    schedule(step);
  }

  // ── Compte à rebours 24h ─────────────────────────────
  function injectCountdown() {
    const target = document.querySelector('.promo-banner__inner, .subcat-header__inner');
    if (!target || document.getElementById('cro-countdown')) return;

    let exp = parseInt(localStorage.getItem('cro_exp') || '0');
    if (!exp || exp < Date.now()) {
      exp = Date.now() + 23 * 60 * 60 * 1000 + Math.random() * 3600000;
      localStorage.setItem('cro_exp', Math.round(exp));
    }

    const div = document.createElement('div');
    div.id = 'cro-countdown';
    div.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#fde68a;margin-top:10px;';
    div.innerHTML = '⏰ Offre expire dans <span id="cd-val" style="font-size:14px;color:#fff;font-weight:900;letter-spacing:1px"></span>';
    target.appendChild(div);

    function tick() {
      const diff = Math.max(0, exp - Date.now());
      const h = String(Math.floor(diff / 3600000)).padStart(2,'0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2,'0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2,'0');
      const el = document.getElementById('cd-val');
      if (el) el.textContent = `${h}:${m}:${s}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  // ── Rareté : "X en stock" ────────────────────────────
  function injectScarcity() {
    const cards = [...document.querySelectorAll('.product-card:not(.cro-done-scarcity)')];
    processChunked(cards, card => {
      card.classList.add('cro-done-scarcity');
      const stockEl = card.querySelector('.card-stock');
      if (!stockEl || stockEl.textContent.includes('limité') || stockEl.textContent.includes('out')) return;
      const name = card.querySelector('.card-title')?.textContent || Math.random().toString();
      const hash = [...name].reduce((a,c) => a + c.charCodeAt(0), 0);
      const qty = (hash % 6) + 2;
      if (qty <= 5) {
        const el = document.createElement('div');
        el.className = 'cro-scarcity';
        el.style.cssText = 'font-size:11px;font-weight:700;color:#d97706;display:flex;align-items:center;gap:3px;margin-bottom:3px;';
        el.innerHTML = `🔥 Plus que ${qty} en stock`;
        stockEl.insertAdjacentElement('beforebegin', el);
      }
    });
  }

  // ── Social proof : vues simulées ─────────────────────
  function injectSocialProof() {
    const cards = [...document.querySelectorAll('.product-card:not(.cro-done-views)')];
    processChunked(cards, card => {
      card.classList.add('cro-done-views');
      const body = card.querySelector('.card-body');
      if (!body) return;
      const name = card.querySelector('.card-title')?.textContent || '';
      const hash = [...name].reduce((a,c) => a + c.charCodeAt(0), 0);
      const n = (hash % 14) + 4;
      const el = document.createElement('div');
      el.className = 'cro-views';
      el.style.cssText = 'font-size:10px;color:#6b7280;margin-bottom:4px;';
      el.textContent = `👁 ${n} personnes regardent`;
      body.insertBefore(el, body.firstChild);
    });
  }

  // ── Best seller sur premier produit de chaque grille ─
  function injectBestSeller() {
    document.querySelectorAll('.products-grid, .products-grid--5, .products-grid--4').forEach(grid => {
      const first = grid.querySelector('.product-card');
      if (!first) return;
      const badges = first.querySelector('.card-badges');
      if (!badges || badges.querySelector('.badge')) return;
      badges.innerHTML = '<span class="badge badge--best">🏆 Top vente</span>';
    });
  }

  // ── Observer pour produits chargés dynamiquement ─────
  let _pending = false;
  function runAll() {
    if (_pending) return;
    _pending = true;
    schedule(() => {
      _pending = false;
      injectScarcity();
      injectSocialProof();
      injectBestSeller();
    });
  }

  function observe() {
    document.querySelectorAll(
      '.products-grid,.products-grid--5,.products-grid--4,#grid-promo'
    ).forEach(grid => {
      new MutationObserver(() => runAll()).observe(grid, { childList: true });
    });
  }

  function init() {
    injectCountdown();
    observe();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  window.addEventListener('catalog:rendered', runAll);
})();
