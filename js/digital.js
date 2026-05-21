// js/digital.js — Logique page produits digitaux
// Charge les produits depuis /api/digital, filtre par onglet, affiche les cartes.
// Sécurité : tout contenu dynamique est inséré via textContent (pas innerHTML).
'use strict';

(function () {

  // ─── Config ────────────────────────────────────────────────────────────────
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

  const COMPAT_LABELS = {
    windows: { icon: '🪟', label: 'Windows' },
    mac:     { icon: '🍎', label: 'macOS'   },
    linux:   { icon: '🐧', label: 'Linux'   },
    ios:     { icon: '📱', label: 'iOS'     },
    android: { icon: '🤖', label: 'Android' },
  };

  const TYPE_INFO = {
    one_time:     { label: 'Achat unique', cls: 'dig-badge--once' },
    subscription: { label: 'Abonnement',   cls: 'dig-badge--sub'  },
    license:      { label: 'Licence',      cls: 'dig-badge--lic'  },
  };

  // ─── State ─────────────────────────────────────────────────────────────────
  let allProducts = [];
  let activeTab   = 'tous';

  // ─── DOM refs ──────────────────────────────────────────────────────────────
  const grid    = document.getElementById('digital-grid');
  const tabsBar = document.getElementById('digital-tabs');
  const counter = document.getElementById('digital-count');
  const empty   = document.getElementById('digital-empty');

  // ─── Helper : créer un élément avec propriétés ─────────────────────────────
  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      Object.entries(props).forEach(([k, v]) => {
        if (k === 'className') node.className = v;
        else if (k === 'textContent') node.textContent = v;
        else if (k === 'ariaLabel') node.setAttribute('aria-label', v);
        else node.setAttribute(k, v);
      });
    }
    (children || []).forEach(c => c && node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  // ─── Formatage prix ────────────────────────────────────────────────────────
  function fmt(n) {
    return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
      const btn = el('button', {
        className:   'dig-tab' + (t.id === activeTab ? ' dig-tab--active' : ''),
        'data-tab':  t.id,
        type:        'button',
        textContent: t.label,
      });
      btn.addEventListener('click', () => setTab(t.id));
      tabsBar.appendChild(btn);
    });
  }

  // ─── Chargement API ────────────────────────────────────────────────────────
  async function loadProducts() {
    if (!grid) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    const loading = el('p', { className: 'dig-loading', textContent: 'Chargement…' });
    loading.setAttribute('aria-live', 'polite');
    grid.appendChild(loading);

    try {
      const qs  = activeTab === 'tous' ? '?limit=100' : `?tab=${encodeURIComponent(activeTab)}&limit=100`;
      const res  = await fetch('/api/digital' + qs);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      allProducts = Array.isArray(data.products) ? data.products : [];
      renderGrid();
    } catch {
      while (grid.firstChild) grid.removeChild(grid.firstChild);
      grid.appendChild(el('p', { className: 'dig-error', textContent: 'Erreur de chargement. Réessayez.' }));
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

    allProducts.forEach(p => grid.appendChild(buildCard(p)));
  }

  // ─── Carte produit (DOM pur) ────────────────────────────────────────────────
  function buildCard(p) {
    const typeInfo   = TYPE_INFO[p.product_type] || TYPE_INFO.one_time;
    const billingStr = p.billing_period === 'monthly' ? '/mois' : p.billing_period === 'yearly' ? '/an' : '';
    const imgSrc     = p.image || '/images/placeholder-digital.svg';
    const article    = el('article', { className: 'dig-card', 'data-id': p.id, 'data-slug': p.slug });

    // Image
    const imgLink = el('a', { href: 'produit.html?id=' + encodeURIComponent(p.slug), className: 'dig-card__img-link', tabindex: '-1' });
    imgLink.setAttribute('aria-hidden', 'true');
    const imgWrap = el('div', { className: 'dig-card__img-wrap' });
    const img = el('img', { src: imgSrc, alt: '', width: '80', height: '80', loading: 'lazy', decoding: 'async', className: 'dig-card__img' });
    imgWrap.appendChild(img);
    imgLink.appendChild(imgWrap);
    article.appendChild(imgLink);

    // Body
    const body = el('div', { className: 'dig-card__body' });

    // Top badges
    const top = el('div', { className: 'dig-card__top' });
    top.appendChild(el('span', { className: 'dig-type-badge ' + typeInfo.cls, textContent: typeInfo.label }));
    if (p.badge) top.appendChild(el('span', { className: 'dig-card__badge ' + (p.badge_class || ''), textContent: p.badge }));
    body.appendChild(top);

    // Titre
    const titleLink = el('a', { href: 'produit.html?id=' + encodeURIComponent(p.slug), className: 'dig-card__title', textContent: p.name });
    body.appendChild(titleLink);

    // Sous-titre
    if (p.subtitle) body.appendChild(el('p', { className: 'dig-card__subtitle', textContent: p.subtitle }));

    // Étoiles
    if (p.rating > 0) {
      const stars = el('div', { className: 'dig-card__stars' });
      stars.setAttribute('aria-label', p.rating + ' étoiles sur 5');
      stars.appendChild(document.createTextNode('★'.repeat(p.rating) + '☆'.repeat(5 - p.rating)));
      stars.appendChild(el('span', { className: 'dig-card__rating-count', textContent: '(' + p.rating_count + ')' }));
      body.appendChild(stars);
    }

    // Méta (appareils + compatibilité)
    const meta = el('div', { className: 'dig-card__meta' });
    if (p.max_devices) {
      const devText = p.max_devices >= 999 ? '📱 Illimité' : '📱 ' + p.max_devices + ' appareil' + (p.max_devices > 1 ? 's' : '');
      meta.appendChild(el('span', { className: 'dig-meta-chip', textContent: devText }));
    }
    const compat = Array.isArray(p.compatibility) ? p.compatibility : [];
    if (compat.length) {
      const compatWrap = el('span', { className: 'dig-meta-compat' });
      compat.forEach(c => {
        const info = COMPAT_LABELS[c];
        if (!info) return;
        const chip = el('span', { className: 'dig-compat', textContent: info.icon });
        chip.setAttribute('title', info.label);
        compatWrap.appendChild(chip);
      });
      meta.appendChild(compatWrap);
    }
    body.appendChild(meta);

    // Prix + bouton
    const footer = el('div', { className: 'dig-card__footer' });
    const priceBlock = el('div', { className: 'dig-card__price-block' });
    if (p.price_old) priceBlock.appendChild(el('span', { className: 'dig-card__price-old', textContent: fmt(p.price_old) + ' €' }));
    const priceSpan = el('span', { className: 'dig-card__price' });
    priceSpan.appendChild(document.createTextNode(fmt(p.price_eur) + ' €'));
    if (billingStr) priceSpan.appendChild(el('span', { className: 'dig-card__billing', textContent: billingStr }));
    priceBlock.appendChild(priceSpan);
    priceBlock.appendChild(el('span', { className: 'dig-card__kmf', textContent: Number(p.price_kmf || 0).toLocaleString('fr-FR') + ' KMF' }));
    footer.appendChild(priceBlock);

    // SVG panier (statique — pas de contenu dynamique)
    const cartBtn = el('button', {
      className:   'dig-card__cart-btn',
      type:        'button',
      ariaLabel:   'Ajouter ' + p.name + ' au panier',
    });
    cartBtn.dataset.id    = p.id;
    cartBtn.dataset.name  = p.name;
    cartBtn.dataset.price = p.price_eur;
    cartBtn.dataset.image = imgSrc;
    cartBtn.dataset.slug  = p.slug;
    // SVG inline safe (contenu statique, pas de données dynamiques)
    cartBtn.setAttribute('data-svg', '1');
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2.5');
    svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.3 2.3c-.6.6-.2 1.7.7 1.7H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z');
    svg.appendChild(path);
    cartBtn.appendChild(svg);
    cartBtn.appendChild(document.createTextNode(' Ajouter'));
    cartBtn.addEventListener('click', () => addToCart(cartBtn.dataset));
    footer.appendChild(cartBtn);
    body.appendChild(footer);

    body.appendChild(el('p', { className: 'dig-delivery-badge', textContent: '⚡ Livraison instantanée après paiement' }));
    article.appendChild(body);
    return article;
  }

  // ─── Changement onglet ─────────────────────────────────────────────────────
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

  // Exposé globalement pour compatibilité anciens appels (nav dropdown links)
  window._digitalSetTab = setTab;

  // ─── Ajout au panier ───────────────────────────────────────────────────────
  function addToCart(data) {
    if (typeof window._cartAdd === 'function') {
      window._cartAdd({ id: data.id, name: data.name, price: parseFloat(data.price), image: data.image, slug: data.slug, quantity: 1 });
      return;
    }
    try {
      const cart     = JSON.parse(localStorage.getItem('cart') || '[]');
      const existing = cart.find(i => i.id === data.id);
      if (existing) existing.quantity = (existing.quantity || 1) + 1;
      else cart.push({ id: data.id, name: data.name, price: parseFloat(data.price), image: data.image, slug: data.slug, quantity: 1 });
      localStorage.setItem('cart', JSON.stringify(cart));
      document.querySelectorAll('.cart-badge').forEach(b => {
        b.textContent = cart.reduce((s, i) => s + (i.quantity || 1), 0);
      });
      showCartFeedback(data.name);
    } catch {}
  }

  function showCartFeedback(name) {
    const fb = el('div', { className: 'dig-cart-feedback', textContent: '✓ ' + name + ' ajouté au panier' });
    document.body.appendChild(fb);
    setTimeout(() => fb.classList.add('dig-cart-feedback--show'), 10);
    setTimeout(() => { fb.classList.remove('dig-cart-feedback--show'); setTimeout(() => fb.remove(), 300); }, 2500);
  }

  // ─── Bootstrap ─────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
