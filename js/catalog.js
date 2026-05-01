// js/catalog.js — Module catalogue partagé
// Source unique : API Supabase. Remplace js/products.js sur toutes les pages catégorie.

const CATALOG = (function () {

  // ─── Image fallback & détection watermark ────────────────────────────────
  const PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 165">' +
    '<rect width="220" height="165" fill="#f1f5f9"/>' +
    '<rect x="90" y="52" width="40" height="32" rx="3" fill="#e2e8f0"/>' +
    '<circle cx="100" cy="62" r="5" fill="#cbd5e1"/>' +
    '<path d="M90 76 l12-9 9 7 9-6 10 8" stroke="#cbd5e1" stroke-width="2" fill="none"/>' +
    '<text x="110" y="112" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#94a3b8">Image non disponible</text>' +
    '</svg>'
  );

  // NB: m.media-amazon.com est un CDN légitime — ne pas bloquer
  const BANNED_IMG_DOMAINS = ['ldlc.com', '/ldlc', 'ldlc-media', 'cdiscount.com', 'fnac.com', 'darty.com', 'boulanger.com'];

  function hasSuspiciousUrl(url) {
    if (!url) return false;
    const u = url.toLowerCase();
    return BANNED_IMG_DOMAINS.some(d => u.includes(d));
  }

  // Réduit les images Amazon CDN à la taille affichée (économise ~95% de bande passante)
  // _SL{N}_ = redimensionne côté CDN so que la plus grande dimension = N px
  function optimizeAmazonImg(url, size) {
    if (!url || !url.includes('m.media-amazon.com/images')) return url;
    // N'applique le resize QUE si l'URL a déjà un modificateur (._AC_SL1500_. etc.)
    // Les IDs plain (ex: 61lN0YzusnL.jpg) sont laissés intacts pour éviter les 404
    if (!url.match(/\._[A-Z]{2}[A-Z0-9_,]+_\./)) return url;
    const [base, qs] = url.split('?');
    const opt = base
      .replace(/\._[^.]+_(?=\.(jpg|jpeg|png))/gi, '')
      .replace(/\.(jpg|jpeg|png)$/i, `._SL${size}_.$1`);
    return qs ? `${opt}?${qs}` : opt;
  }

  // Exposé globalement pour onerror HTML inline
  window.imgFallback = function(el) {
    el.onerror = null;
    el.src = PLACEHOLDER_IMG;
    el.closest('.card-img, .gallery__main, .gallery__thumb')?.classList.add('card-img--broken');
  };

  // ─── Utilitaires ─────────────────────────────────────────────────────────
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function stars(n) {
    const r = Math.min(5, Math.max(0, Math.round(Number(n) || 0)));
    return '★'.repeat(r) + '☆'.repeat(5 - r);
  }

  function fmtEur(n) {
    const v = Number(n) || 0;
    const [int, dec] = v.toFixed(2).split('.');
    return Number(int).toLocaleString('fr-FR') + '<span class="price-cents">,' + dec + ' \u20ac</span>';
  }

  function fmtKmf(kmf, eur) {
    const v = Number(kmf);
    return (v > 0 ? v : Math.round((Number(eur) || 0) * 492)).toLocaleString('fr-FR');
  }

  function specsSummary(specs) {
    if (!specs || typeof specs !== 'object') return '';
    const rows = Object.entries(specs).filter(([k]) => !k.startsWith('_')).slice(0, 3);
    if (!rows.length) return '';
    return '<div class="card-specs">'
      + rows.map(([k, v]) => `<span><strong>${esc(k)}:</strong> ${esc(v)}</span>`).join(' · ')
      + '</div>';
  }

  // ─── Carte produit ────────────────────────────────────────────────────────
  // opts.promoMode   : calcule le badge -XX% depuis price_old
  // opts.stockLabel  : remplace le stock_label DB (ex: "✅ Certifié et garanti")
  // cardIdx : position dans la grille (0-based) — les 4 premières cartes sont above-fold
  function productCard(p, opts = {}, cardIdx = 99) {
    const link    = p.legacy_id || p.id;
    const rawImg  = p.main_image_url || p.image || '';
    // 380px = bon compromis pour un affichage carte 162px (2.3× Retina)
    const imgSrc  = hasSuspiciousUrl(rawImg) ? PLACEHOLDER_IMG : optimizeAmazonImg(rawImg || PLACEHOLDER_IMG, 380);
    const ratingN = Number(p.rating_count) || 0;
    const isLCP   = cardIdx < 4; // au-dessus de la ligne de flottaison

    let badgeHtml;
    if (opts.promoMode && p.price_old && Number(p.price_old) > 0) {
      const pct = Math.round((1 - Number(p.price_eur) / Number(p.price_old)) * 100);
      badgeHtml = `<div class="card-badges"><span class="badge badge--promo">-${pct}%</span></div>`;
    } else if (p.badge) {
      badgeHtml = `<div class="card-badges"><span class="badge ${p.badge_class || ''}">${esc(p.badge)}</span></div>`;
    } else {
      badgeHtml = '<div class="card-badges"></div>';
    }

    const oldPrice = p.price_old && Number(p.price_old) > 0
      ? `<span class="price-old">${fmtEur(p.price_old)}</span>` : '';

    const stockLabel = opts.stockLabel || p.stock_label || 'En stock';
    const stockClass = opts.stockLabel ? 'in-stock' : (p.stock_class || 'in-stock');

    return `<div class="product-card">
      ${badgeHtml}
      <button class="card-wishlist" onclick="toggleWish(this)" aria-label="Ajouter aux favoris">\u2661</button>
      <div class="card-img">
        <img src="${imgSrc}" alt="${esc(p.name || '')}" width="220" height="170" ${isLCP ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} onerror="imgFallback(this)">
      </div>
      <div class="card-body">
        <div class="card-brand">${esc(p.brand || '')}</div>
        <div class="card-title">${esc(p.name || '')}${p.subtitle ? ' \u2014 ' + esc(p.subtitle) : ''}</div>
        ${specsSummary(p.specs)}
        <div class="card-rating">
          <span class="stars">${stars(p.rating)}</span>
          <span class="rating-count">(${ratingN})</span>
        </div>
        <div class="card-price-block">
          ${Number(p.price_eur) > 0 ? `
          ${oldPrice}
          <span class="price-main">${fmtEur(p.price_eur)}</span>
          <div class="price-kmf">\u2248 ${fmtKmf(p.price_kmf, p.price_eur)} KMF</div>
          <div class="price-ttc">Prix TTC</div>` : `<span class="price-main" style="font-size:14px;color:#94a3b8">Prix sur demande</span>`}
        </div>
        <div class="card-stock ${stockClass}">${stockLabel}</div>
      </div>
      <div class="card-footer">
        <button class="btn-cart" onclick="addToCart(this,'${link}')">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          Ajouter
        </button>
        <a href="produit.html?id=${link}" class="btn-detail">Voir le d\u00e9tail</a>
      </div>
    </div>`;
  }

  // ─── Fetch API ────────────────────────────────────────────────────────────
  const MAX = 5;
  const gridsState    = {};
  const gridsExpanded = {};

  async function loadProducts(subcategory) {
    try {
      const res = await fetch(`/api/products?subcategory=${encodeURIComponent(subcategory)}&status=active&limit=100`);
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    } catch (e) {
      console.error('[catalog] fetch error:', subcategory, e);
      return [];
    }
  }

  async function loadAllActive() {
    try {
      const res = await fetch('/api/products?status=active&limit=500');
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    } catch (e) {
      console.error('[catalog] loadAllActive error:', e);
      return [];
    }
  }

  // ─── Rendu grille ─────────────────────────────────────────────────────────
  async function renderGrid(subcategory, opts = {}) {
    const grid  = document.getElementById('grid-' + subcategory);
    const count = document.getElementById('count-' + subcategory);
    if (!grid) return;

    let allList;
    if (gridsState[subcategory] !== undefined) {
      allList = gridsState[subcategory];
    } else {
      allList = await loadProducts(subcategory);
      gridsState[subcategory] = allList;
    }

    const expanded = gridsExpanded[subcategory] || false;
    const visible  = expanded ? allList : allList.slice(0, MAX);

    if (allList.length === 0) {
      grid.innerHTML = '<p style="padding:32px;text-align:center;color:#94a3b8;grid-column:1/-1">Aucun produit disponible dans cette catégorie pour le moment.</p>';
      if (count) count.innerHTML = '<strong>0</strong> produit disponible';
      const w = document.getElementById('voir-tout-' + subcategory);
      if (w) w.innerHTML = '';
      return;
    }

    grid.innerHTML = visible.map((p, i) => productCard(p, opts, i)).join('');
    if (count) count.innerHTML = `<strong>${allList.length}</strong> produit${allList.length > 1 ? 's' : ''} disponible${allList.length > 1 ? 's' : ''}`;

    const btnId = 'voir-tout-' + subcategory;
    let wrap = document.getElementById(btnId);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = btnId;
      wrap.className = 'voir-tout-wrap';
      grid.after(wrap);
    }
    if (allList.length > MAX) {
      const r = allList.length - MAX;
      wrap.innerHTML = expanded
        ? `<button class="btn-voir-tout" onclick="CATALOG.toggleExpand('${subcategory}')">Afficher moins \u2191</button>`
        : `<button class="btn-voir-tout" onclick="CATALOG.toggleExpand('${subcategory}')">Voir les ${r} autre${r > 1 ? 's' : ''} produit${r > 1 ? 's' : ''} \u2192</button>`;
    } else {
      wrap.innerHTML = '';
    }
  }

  function toggleExpand(subcategory) {
    gridsExpanded[subcategory] = !gridsExpanded[subcategory];
    renderGrid(subcategory);
  }

  async function sortGrid(subcategory, mode, opts = {}) {
    let list = gridsState[subcategory] !== undefined
      ? [...gridsState[subcategory]]
      : await loadProducts(subcategory);
    if (mode === 'price-asc')  list.sort((a, b) => (a.price_eur || 0) - (b.price_eur || 0));
    if (mode === 'price-desc') list.sort((a, b) => (b.price_eur || 0) - (a.price_eur || 0));
    if (mode === 'rating')     list.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.rating_count || 0) - (a.rating_count || 0));
    gridsState[subcategory] = list;
    gridsExpanded[subcategory] = false;
    renderGrid(subcategory, opts);
  }

  // ─── Navigation onglets ───────────────────────────────────────────────────
  function initTabs(tabs) {
    window.showTab = function (id, btn) {
      document.querySelectorAll('.subcat-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      const sec = document.getElementById('tab-' + id);
      if (sec) sec.classList.add('active');
      if (btn) btn.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const urlTab = new URLSearchParams(window.location.search).get('tab');
    if (urlTab && tabs.includes(urlTab)) {
      const tabBtns = document.querySelectorAll('.cat-tab');
      const idx = tabs.indexOf(urlTab);
      document.querySelectorAll('.subcat-section').forEach(s => s.classList.remove('active'));
      tabBtns.forEach(t => t.classList.remove('active'));
      const sec = document.getElementById('tab-' + urlTab);
      if (sec) sec.classList.add('active');
      if (tabBtns[idx]) tabBtns[idx].classList.add('active');
    }
  }

  // ─── Panier / Wishlist / Recherche ────────────────────────────────────────
  function initPage() {
    let cartCount = 0;
    window.addToCart = function (btn, id) {
      cartCount++;
      const badge = document.querySelector('.cart-badge');
      if (badge) badge.textContent = cartCount;
      const n = document.getElementById('cart-notif');
      if (n) { n.style.display = 'flex'; setTimeout(() => n.style.display = 'none', 2500); }
    };
    window.toggleWish = function (btn) {
      const liked = btn.textContent === '\u2665';
      btn.textContent = liked ? '\u2661' : '\u2665';
      btn.style.color = liked ? '' : '#ef4444';
      btn.style.borderColor = liked ? '' : '#ef4444';
    };
    window.doSearch = function () {
      const input = document.getElementById('searchInput');
      const q = input ? input.value.trim() : '';
      if (q) window.location.href = 'index.html?q=' + encodeURIComponent(q);
    };
    const si = document.getElementById('searchInput');
    if (si) si.addEventListener('keydown', e => { if (e.key === 'Enter') window.doSearch(); });
    window.sortGrid = sortGrid;
  }

  // ─── Points d'entrée publics ──────────────────────────────────────────────

  // Pages multi-onglets (stockage, écrans, périphériques, composants, réseau, reconditionnés)
  function init(tabs, opts = {}) {
    initPage();
    initTabs(tabs);
    tabs.forEach(t => renderGrid(t, opts));
  }

  // Pages grille unique (protection.html, services.html)
  async function initFlat(subcategory, opts = {}) {
    initPage();
    await renderGrid(subcategory, opts);
    window.sortProds = (mode) => sortGrid(subcategory, mode, opts);
  }

  // Page promotions — produits actifs filtrés sur price_old
  async function initPromo() {
    initPage();
    const grid  = document.getElementById('grid-promo');
    const count = document.getElementById('promo-count');
    if (!grid) return;

    const all = await loadAllActive();

    function pct(p) {
      if (!p.price_old || !Number(p.price_old)) return 0;
      return Math.round((1 - Number(p.price_eur) / Number(p.price_old)) * 100);
    }

    // 1 produit par sous-catégorie (category_id) — prend le mieux noté
    // Priorité : ceux avec price_old (déjà en promo) d'abord
    const byCat = {};
    all.forEach(p => {
      const cat = p.category_id || 'other';
      const existing = byCat[cat];
      if (!existing) { byCat[cat] = p; return; }
      // Préfère celui avec une promo active
      const hasPromo = p.price_old && Number(p.price_old) > 0;
      const existHasPromo = existing.price_old && Number(existing.price_old) > 0;
      if (hasPromo && !existHasPromo) { byCat[cat] = p; return; }
      if (!hasPromo && existHasPromo) return;
      // Si même statut, prend le mieux noté
      if ((p.rating_count || 0) > (existing.rating_count || 0)) byCat[cat] = p;
    });

    // Trie : promos d'abord (par %) puis les autres (par note)
    let promo = Object.values(byCat)
      .sort((a, b) => {
        const pa = pct(a), pb = pct(b);
        if (pb !== pa) return pb - pa;
        return (b.rating_count || 0) - (a.rating_count || 0);
      })
      .slice(0, 8);

    function renderPromo(list) {
      grid.innerHTML = list.map(p => productCard(p, { promoMode: true })).join('');
      if (count) count.innerHTML = `<strong>${list.length}</strong> offre${list.length > 1 ? 's' : ''} en promotion`;
    }
    renderPromo(promo);

    window.sortPromo = function (mode) {
      let list = [...promo];
      if (mode === 'discount')   list.sort((a, b) => pct(b) - pct(a));
      if (mode === 'price-asc')  list.sort((a, b) => (a.price_eur || 0) - (b.price_eur || 0));
      if (mode === 'price-desc') list.sort((a, b) => (b.price_eur || 0) - (a.price_eur || 0));
      if (mode === 'rating')     list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      renderPromo(list);
    };
  }

  return { init, initFlat, initPromo, renderGrid, sortGrid, toggleExpand, productCard };

})();
