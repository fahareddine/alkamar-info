// js/digital.js — Catalogue Produits Digitaux
// Cards identiques aux product-card existantes (catalog.js)
'use strict';

(function () {

  const TABS = [
    { id: 'tous',        label: '🌐 Tous'          },
    { id: 'logiciels',   label: '💿 Logiciels'      },
    { id: 'abonnements', label: '🔄 Abonnements'    },
    { id: 'licences',    label: '🔑 Licences'       },
    { id: 'antivirus',   label: '🛡️ Antivirus'      },
    { id: 'outils-ia',   label: '🤖 Outils IA'      },
    { id: 'saas',        label: '☁️ SaaS'            },
    { id: 'premium',     label: '⭐ Offres Premium'  },
  ];

  let allProducts = [];
  let activeTab   = 'tous';

  const grid    = document.getElementById('digital-grid');
  const tabsBar = document.getElementById('digital-tabs');
  const counter = document.getElementById('digital-count');
  const empty   = document.getElementById('digital-empty');

  const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 165">' +
    '<rect width="220" height="165" fill="#f1f5f9"/>' +
    '<text x="110" y="90" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#94a3b8">Image non disponible</text>' +
    '</svg>'
  );

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function mk(tag, props) {
    const n = document.createElement(tag);
    if (!props) return n;
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'className') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    });
    return n;
  }

  function fmtPrice(n) {
    const v = Number(n) || 0;
    const [int, dec] = v.toFixed(2).split('.');
    return { int: Number(int).toLocaleString('fr-FR'), dec };
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init() {
    const params = new URLSearchParams(window.location.search);
    activeTab = params.get('tab') || 'tous';
    renderTabs();
    loadProducts();
  }

  // ─── Onglets ───────────────────────────────────────────────────────────────
  function renderTabs() {
    if (!tabsBar) return;
    while (tabsBar.firstChild) tabsBar.removeChild(tabsBar.firstChild);
    TABS.forEach(t => {
      const b = mk('button', {
        className: 'dig-tab' + (t.id === activeTab ? ' dig-tab--active' : ''),
        'data-tab': t.id, type: 'button', text: t.label,
      });
      b.textContent = t.label;
      b.addEventListener('click', () => setTab(t.id));
      tabsBar.appendChild(b);
    });
  }

  // ─── Fetch API — 4 produits max par onglet (sauf "tous") ──────────────────
  async function loadProducts() {
    if (!grid) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    const p = mk('p', { className: 'dig-loading' });
    p.textContent = 'Chargement…';
    p.setAttribute('aria-live', 'polite');
    grid.appendChild(p);
    try {
      const limit = activeTab === 'tous' ? 100 : 4;
      const qs = activeTab === 'tous'
        ? '?limit=' + limit
        : '?tab=' + encodeURIComponent(activeTab) + '&limit=' + limit;
      const res = await fetch('/api/digital' + qs);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      allProducts = (Array.isArray(data.products) ? data.products : []).slice(0, limit);
      renderGrid();
    } catch {
      while (grid.firstChild) grid.removeChild(grid.firstChild);
      const err = mk('p', { className: 'dig-error' });
      err.textContent = 'Erreur de chargement. Réessayez.';
      grid.appendChild(err);
    }
  }

  // ─── Grille ────────────────────────────────────────────────────────────────
  function renderGrid() {
    if (!grid) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    if (!allProducts.length) {
      if (empty) empty.hidden = false;
      if (counter) counter.textContent = '0 produit';
      return;
    }
    if (empty) empty.hidden = true;
    if (counter) counter.textContent = allProducts.length + ' produit' + (allProducts.length > 1 ? 's' : '');
    allProducts.forEach((p, i) => grid.appendChild(buildCard(p, i)));
  }

  // ─── Card — structure identique product-card ──────────────────────────────
  function buildCard(p, idx) {
    const link  = p.slug || p.id;
    const isLCP = idx < 4;

    // Wrapper
    const card = mk('div', { className: 'product-card' + (p.badge ? ' has-badge' : '') });

    // ── Badges ──
    const badgesDiv = mk('div', { className: 'card-badges' });
    if (p.badge) {
      const b = mk('span', { className: 'badge ' + (p.badge_class || 'badge--deal') });
      b.textContent = p.badge;
      badgesDiv.appendChild(b);
    }
    card.appendChild(badgesDiv);

    // ── Images — affichage 2 photos côte à côte si gallery disponible ─────
    const gallery = Array.isArray(p.gallery) ? p.gallery.filter(Boolean) : [];
    const img2src  = gallery[0] || null;
    const hasDual  = !!img2src;
    const cardImg  = mk('div', { className: hasDual ? 'card-img card-img--duo' : 'card-img' });

    function makeImg(src, alt, priority) {
      const el = mk('img', {
        src: src || PLACEHOLDER,
        alt: alt || '',
        width: hasDual ? '100' : '220',
        height: hasDual ? '80' : '170',
        loading: (priority && isLCP) ? 'eager' : 'lazy',
        decoding: 'async',
      });
      el.onerror = function () { this.onerror = null; this.src = PLACEHOLDER; };
      return el;
    }

    cardImg.appendChild(makeImg(p.image, p.name, true));
    if (hasDual) cardImg.appendChild(makeImg(img2src, (p.brand || p.name) + ' — vue produit', false));
    card.appendChild(cardImg);

    // ── Body ──
    const body = mk('div', { className: 'card-body' });

    if (p.brand) {
      const brand = mk('div', { className: 'card-brand' });
      brand.textContent = p.brand;
      body.appendChild(brand);
    }

    const billingStr = p.billing_period === 'monthly' ? ' — Mensuel'
                     : p.billing_period === 'yearly'  ? ' — Annuel' : '';
    const titleText = (p.name || '') + (p.subtitle ? ' — ' + p.subtitle : '') + billingStr;
    const title = mk('div', { className: 'card-title' });
    title.textContent = titleText;
    body.appendChild(title);

    // Specs (3 premières clés)
    const specsObj = p.specs && typeof p.specs === 'object' ? p.specs : {};
    const entries  = Object.entries(specsObj).filter(([k]) => !k.startsWith('_')).slice(0, 3);
    if (entries.length) {
      const specsDiv = mk('div', { className: 'card-specs' });
      entries.forEach(([k, v], i) => {
        const span = mk('span');
        const strong = mk('strong');
        strong.textContent = k + ':';
        span.appendChild(strong);
        span.appendChild(document.createTextNode(' ' + v));
        specsDiv.appendChild(span);
        if (i < entries.length - 1) specsDiv.appendChild(document.createTextNode(' · '));
      });
      body.appendChild(specsDiv);
    }

    // Étoiles
    if (Number(p.rating) > 0) {
      const rDiv = mk('div', { className: 'card-rating' });
      const stars = mk('span', { className: 'stars' });
      stars.textContent = '★'.repeat(p.rating) + '☆'.repeat(5 - p.rating);
      const cnt = mk('span', { className: 'rating-count' });
      cnt.textContent = '(' + (Number(p.rating_count) || 0) + ')';
      rDiv.appendChild(stars);
      rDiv.appendChild(cnt);
      body.appendChild(rDiv);
    }

    // Prix
    if (Number(p.price_eur) > 0) {
      const priceBlock = mk('div', { className: 'card-price-block' });

      if (p.price_old && Number(p.price_old) > 0) {
        const { int: oi, dec: od } = fmtPrice(p.price_old);
        const old = mk('span', { className: 'price-old' });
        old.appendChild(document.createTextNode(oi));
        const oc = mk('span', { className: 'price-cents' });
        oc.textContent = ',' + od + ' €';
        old.appendChild(oc);
        priceBlock.appendChild(old);
      }

      const { int, dec } = fmtPrice(p.price_eur);
      const billing = p.billing_period === 'monthly' ? '/mois' : p.billing_period === 'yearly' ? '/an' : '';
      const priceMain = mk('span', { className: 'price-main' });
      priceMain.appendChild(document.createTextNode(int));
      const cents = mk('span', { className: 'price-cents' });
      cents.textContent = ',' + dec + ' €' + billing;
      priceMain.appendChild(cents);
      priceBlock.appendChild(priceMain);

      const kmf = mk('div', { className: 'price-kmf' });
      kmf.textContent = '≈ ' + Number(p.price_kmf || 0).toLocaleString('fr-FR') + ' KMF';
      priceBlock.appendChild(kmf);

      const ttc = mk('div', { className: 'price-ttc' });
      ttc.textContent = 'Prix TTC';
      priceBlock.appendChild(ttc);

      body.appendChild(priceBlock);
    }

    // Stock
    const stock = mk('div', { className: 'card-stock in-stock' });
    stock.textContent = '⚡ Livraison instantanée';
    body.appendChild(stock);

    card.appendChild(body);

    // ── Footer ──
    const footer = mk('div', { className: 'card-footer' });

    const cartBtn = mk('button', { className: 'btn-cart', type: 'button' });
    cartBtn.setAttribute('aria-label', 'Ajouter ' + (p.name || '') + ' au panier');
    cartBtn.dataset.id    = p.id;
    cartBtn.dataset.name  = p.name || '';
    cartBtn.dataset.price = p.price_eur;
    cartBtn.dataset.image = p.image || '';
    cartBtn.dataset.slug  = link;

    const ns  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2'); svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '14'); svg.setAttribute('height', '14'); svg.setAttribute('aria-hidden', 'true');
    const pathEl = document.createElementNS(ns, 'path');
    pathEl.setAttribute('stroke-linecap', 'round'); pathEl.setAttribute('stroke-linejoin', 'round');
    pathEl.setAttribute('d', 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z');
    svg.appendChild(pathEl);
    cartBtn.appendChild(svg);
    cartBtn.appendChild(document.createTextNode(' Ajouter'));
    cartBtn.addEventListener('click', () => addToCart(cartBtn.dataset));
    footer.appendChild(cartBtn);

    const detail = mk('a', { href: 'produit.html?id=' + encodeURIComponent(link), className: 'btn-detail' });
    detail.setAttribute('aria-label', 'Voir le détail de ' + (p.name || ''));
    detail.textContent = 'Voir le détail';
    footer.appendChild(detail);

    card.appendChild(footer);
    return card;
  }

  // ─── Changement d'onglet ───────────────────────────────────────────────────
  function setTab(tab) {
    activeTab = tab;
    const url = new URL(window.location.href);
    if (tab === 'tous') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    history.replaceState(null, '', url.toString());
    document.querySelectorAll('.dig-tab').forEach(b => {
      b.classList.toggle('dig-tab--active', b.dataset.tab === tab);
    });
    loadProducts();
  }

  window._digitalSetTab = setTab;

  // ─── Ajout panier ──────────────────────────────────────────────────────────
  function addToCart(data) {
    if (typeof window._cartAdd === 'function') {
      window._cartAdd({ id: data.id, name: data.name, price: parseFloat(data.price), image: data.image, slug: data.slug, quantity: 1 });
      return;
    }
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const ex = cart.find(i => i.id === data.id);
      if (ex) ex.quantity = (ex.quantity || 1) + 1;
      else cart.push({ id: data.id, name: data.name, price: parseFloat(data.price), image: data.image, slug: data.slug, quantity: 1 });
      localStorage.setItem('cart', JSON.stringify(cart));
      document.querySelectorAll('.cart-badge').forEach(b => {
        b.textContent = cart.reduce((s, i) => s + (i.quantity || 1), 0);
      });
    } catch {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
