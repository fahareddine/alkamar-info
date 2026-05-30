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

  function wishGet(id) {
    if (!id) return false;
    try { return JSON.parse(localStorage.getItem('alkamar_wish') || '[]').includes(String(id)); }
    catch { return false; }
  }

  const SPEC_ICONS = [
    [/[eé]cran|screen|display|taille/i,              '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'],
    [/\bram\b|m[ée]moire/i,                          '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="8" width="20" height="8" rx="1"/><path d="M7 8V6M10 8V6M13 8V6M16 8V6M7 16v2M10 16v2M13 16v2M16 16v2"/></svg>'],
    [/processeur|cpu|ryzen|core.i|intel|amd/i,       '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="7" y="7" width="10" height="10" rx="1"/><path d="M9 4v3M12 4v3M15 4v3M9 17v3M12 17v3M15 17v3M4 9h3M4 12h3M4 15h3M17 9h3M17 12h3M17 15h3"/></svg>'],
    [/\bgpu\b|graphique|nvidia|radeon|vid[ée]o/i,    '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="12" r="2"/><path d="M6 7V5M10 7V5M14 7V5M18 7V5"/></svg>'],
    [/stockage|ssd|hdd|disque|nvme|capacit/i,        '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M18 12h.5"/></svg>'],
    [/poids|kg\b/i,                                  '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 3a3 3 0 100 6 3 3 0 000-6zM5 21l2-8h10l2 8H5z"/></svg>'],
    [/webcam|cam[ée]ra|\bcam\b/i,                    '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 10l4.553-2.069A1 1 0 0121 8.9v6.2a1 1 0 01-1.447.969L15 14v-4z"/><rect x="3" y="8" width="12" height="8" rx="2"/></svg>'],
    [/batterie|autonomie|wh\b|mah\b/i,               '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2M6 12h6"/></svg>'],
    [/\bos\b|windows|linux|android|syst[èe]me/i,     '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>'],
    [/wifi|wi.fi|bluetooth|sans.fil|connexion/i,     '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>'],
    [/\bport|usb|hdmi|thunderbolt/i,                 '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 3v14M7 19s2-2 5-2 5 2 5 2M8 8l-2 2 2 2M16 8l2 2-2 2"/></svg>'],
    [/fr[ée]quence|d[ée]bit|bande|vitesse|mbps|gbps|ghz/i, '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a10 10 0 000 20M12 2a10 10 0 110 20M12 12l-2-5"/></svg>'],
    [/antenne|r[ée]seau|lan|ethernet|norme|standard/i, '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49M7.76 7.76a6 6 0 000 8.49"/></svg>'],
  ];
  const SPEC_DEFAULT_ICON = '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.5"/></svg>';

  function specsSummary(specs) {
    if (!specs || typeof specs !== 'object') return '';
    const rows = Object.entries(specs).filter(([k]) => !k.startsWith('_')).slice(0, 3);
    if (!rows.length) return '';
    return '<div class="card-specs">'
      + rows.map(([k, v]) => {
          const icon  = (SPEC_ICONS.find(([re]) => re.test(k)) || [, SPEC_DEFAULT_ICON])[1];
          const val   = String(v);
          const short = val.length > 26 ? val.slice(0, 25) + '…' : val;
          const title = val !== short ? ` title="${esc(k + ': ' + val)}"` : '';
          return `<span${title}>${icon} ${esc(short)}</span>`;
        }).join('')
      + '</div>';
  }

  const BADGE_LABELS = { TPP: 'Top Prix', BDP: 'Bon Deal', EXC: 'Exclusif', RECO: 'Recommandé', NVX: 'Nouveau' };

  // ─── Carte produit ────────────────────────────────────────────────────────
  // opts.promoMode   : calcule le badge -XX% depuis price_old
  // opts.stockLabel  : remplace le stock_label DB (ex: "✅ Certifié et garanti")
  // cardIdx : position dans la grille (0-based) — les 4 premières cartes sont above-fold
  function productCard(p, opts = {}, cardIdx = 99) {
    const link    = p.legacy_id || p.id;
    const wished  = wishGet(link);
    const rawImg     = p.main_image_url || p.image || '';
    const isBanned   = hasSuspiciousUrl(rawImg);
    const imgSrc     = isBanned ? PLACEHOLDER_IMG : optimizeAmazonImg(rawImg || PLACEHOLDER_IMG, 380);
    const isAmazon   = !isBanned && rawImg && rawImg.includes('media-amazon.com');
    // sizes=200px mobile (réel ~193px) → DPR1.75: 200×1.75=350<380 → picks 380w au lieu de 400w
    const srcsetAttr = isAmazon
      ? `srcset="${optimizeAmazonImg(rawImg, 240)} 240w, ${imgSrc} 380w, ${optimizeAmazonImg(rawImg, 400)} 400w, ${optimizeAmazonImg(rawImg, 450)} 450w" sizes="(min-width: 1200px) 162px, 200px"`
      : '';
    const ratingN    = Number(p.rating_count) || 0;
    const isLCP      = cardIdx < 4; // au-dessus de la ligne de flottaison
    const imgLoadAttrs = cardIdx === 0
      ? 'loading="eager" fetchpriority="high" decoding="auto"'
      : isLCP ? 'loading="eager" decoding="async"' : 'loading="lazy" decoding="async"';

    let badgeHtml;
    if (opts.promoMode && p.price_old && Number(p.price_old) > 0) {
      const pct = Math.round((1 - Number(p.price_eur) / Number(p.price_old)) * 100);
      badgeHtml = `<div class="card-badges"><span class="badge badge--promo">-${pct}%</span></div>`;
    } else if (p.badge) {
      const badgeLabel = BADGE_LABELS[p.badge] || p.badge;
      badgeHtml = `<div class="card-badges"><span class="badge ${p.badge_class || ''}">${esc(badgeLabel)}</span></div>`;
    } else {
      badgeHtml = '<div class="card-badges"></div>';
    }

    const oldPrice = p.price_old && Number(p.price_old) > 0
      ? `<span class="price-old">${fmtEur(p.price_old)}</span>` : '';

    const stockLabel = opts.stockLabel || p.stock_label || 'En stock';
    const stockClass = opts.stockLabel ? 'in-stock' : (p.stock_class || 'in-stock');

    const _hasBadge = badgeHtml.includes('<span class="badge');
    return `<div class="product-card${_hasBadge ? ' has-badge' : ''}">
      ${badgeHtml}
      <div class="card-img">
        <button class="card-wishlist${wished ? ' wished' : ''}" data-id="${esc(String(link || ''))}" onclick="toggleWish(this)" aria-label="${wished ? 'Retirer des favoris' : 'Ajouter aux favoris'}"><svg viewBox="0 0 24 24" width="16" height="16" fill="${wished ? '#ef4444' : 'none'}" stroke="${wished ? '#ef4444' : 'currentColor'}" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg></button>
        <img src="${imgSrc}" ${srcsetAttr} alt="${esc(p.name || '')}" width="220" height="170" ${imgLoadAttrs} onerror="imgFallback(this)">
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
          <div class="price-kmf">\u2248 ${fmtKmf(p.price_kmf, p.price_eur)} KMF</div>` : `<span class="price-main" style="font-size:14px;color:#94a3b8">Prix sur demande</span>`}
        </div>
        <div class="card-stock ${stockClass}">${stockLabel}</div>
      </div>
      <div class="card-footer">
        <button class="btn-cart" onclick="addToCart(this,'${link}')" aria-label="Ajouter ${esc(p.name || '')} au panier">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          Ajouter
        </button>
        <a href="produit.html?id=${link}" class="btn-detail" aria-label="Voir le d\u00e9tail de ${esc(p.name || '')}">Voir le d\u00e9tail</a>
      </div>
    </div>`;
  }

  // ─── Fetch API ────────────────────────────────────────────────────────────
  const MAX = 4;
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

  // ─── Scroll vers la zone produits (compense le header sticky) ────────────
  function scrollToProducts() {
    const target = document.querySelector('.cat-tabs') ||
                   document.querySelector('.subcat-section.active') ||
                   document.querySelector('.products-grid');
    if (!target) return;
    const header = document.querySelector('.header');
    const headerH = header ? header.getBoundingClientRect().height : 60;
    const top = target.getBoundingClientRect().top + window.pageYOffset - headerH - 8;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  // ─── Navigation onglets ───────────────────────────────────────────────────
  function initTabs(tabs) {
    window.showTab = function (id, btn) {
      document.querySelectorAll('.subcat-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      const sec = document.getElementById('tab-' + id);
      if (sec) sec.classList.add('active');
      if (btn) btn.classList.add('active');
      scrollToProducts();
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
      // Scroll vers les produits après chargement initial
      requestAnimationFrame(() => setTimeout(scrollToProducts, 250));
    }
  }

  // ─── Panier / Wishlist / Recherche ────────────────────────────────────────
  function initPage() {
    window.addToCart = function (btn, id) {
      // Récupère infos produit depuis la carte DOM
      const card = btn?.closest('.product-card');
      const name  = card?.querySelector('.card-title')?.textContent?.trim() || '';
      const brand = card?.querySelector('.card-brand')?.textContent?.trim() || '';
      const priceRaw = card?.querySelector('.price-main')?.childNodes[0]?.textContent?.trim().replace(/\s/g,'').replace(',','.') || '0';
      const img   = card?.querySelector('.card-img img')?.src || '';
      const product = {
        id   : id || String(Date.now()),
        name, brand,
        price_eur: parseFloat(priceRaw) || 0,
        main_image_url: img,
      };
      if (typeof Cart !== 'undefined') Cart.add(product);
      if (typeof CartUI !== 'undefined') CartUI.open();
      // Animation bouton
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '✓ Ajouté';
        btn.style.background = '#059669';
        setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 1600);
      }
    };
    window.toggleWish = function (btn) {
      const id = btn.dataset.id;
      if (!id) return;
      const card = btn.closest('.product-card');
      const productData = {
        name:       card ? ((card.querySelector('.card-title') || {}).textContent || '').trim() : '',
        brand:      card ? ((card.querySelector('.card-brand') || {}).textContent || '').trim() : '',
        price_eur:  parseFloat(((card ? (card.querySelector('.price-main') || {}) : {}).childNodes[0] || {}).textContent || '0') || 0,
        price_kmf:  parseInt(((card ? (card.querySelector('.price-kmf') || {}).textContent : '') || '0').replace(/\D/g, '')) || 0,
        img:        card ? ((card.querySelector('.card-img img') || {}).src || '') : '',
        stock:      card ? (card.querySelector('.card-stock') || {}).textContent || '' : '',
        stockClass: card ? ((card.querySelector('.card-stock') || {}).className || '').replace('card-stock', '').trim() : '',
      };
      const wishlist = window.Wishlist || _wishFallback();
      const result = wishlist.toggle(id, productData);
      const added = result.added;
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.setAttribute('fill', added ? '#ef4444' : 'none');
        svg.setAttribute('stroke', added ? '#ef4444' : 'currentColor');
      }
      btn.classList.toggle('wished', added);
      btn.setAttribute('aria-label', added ? 'Retirer des favoris' : 'Ajouter aux favoris');
    };

    function _wishFallback() {
      var KEY = 'alkamar_wish';
      return {
        toggle: function(id, data) {
          try {
            var list = JSON.parse(localStorage.getItem(KEY) || '[]');
            var idx = list.findIndex(function(p) { return (p.id || p) === String(id); });
            var added;
            if (idx !== -1) { list.splice(idx, 1); added = false; }
            else { list.push(Object.assign({ id: String(id) }, data)); added = true; }
            localStorage.setItem(KEY, JSON.stringify(list));
            return { added: added };
          } catch(e) { return { added: false }; }
        }
      };
    }
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
    // Auto-scroll vers les produits si ?tab= n'a pas déjà déclenché le scroll
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    if (!urlTab || !tabs.includes(urlTab)) {
      requestAnimationFrame(() => scrollToProducts());
    }
  }

  // Pages grille unique (protection.html, services.html)
  async function initFlat(subcategory, opts = {}) {
    initPage();
    await renderGrid(subcategory, opts);
    window.sortProds = (mode) => sortGrid(subcategory, mode, opts);
    scrollToProducts();
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
      // L'API retourne categories(id,...) comme objet joint, pas category_id direct
      const cat = p.categories?.id || p.categories?.slug || 'other';
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
    scrollToProducts();

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
