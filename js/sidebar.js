/* sidebar.js — Sidebar de filtres partagée — toutes pages boutique */
(function () {

  const PAGE = window.location.pathname.split('/').pop() || 'index.html';
  const IS_INDEX = PAGE === 'index.html' || PAGE === '';

  function active(p) { return PAGE === p ? 'active' : ''; }

  const SIDEBAR_HTML = `
  <aside class="sidebar" id="shared-sidebar">

    <!-- Recherche -->
    <div class="sidebar-block">
      <div class="sidebar-block__title">Recherche</div>
      <div class="sidebar-block__body" style="padding:10px 14px">
        <div style="position:relative">
          <input type="text" id="sidebar-search" placeholder="Rechercher un produit…"
            style="width:100%;padding:8px 34px 8px 10px;border:1.5px solid #e5e7eb;border-radius:6px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box;transition:border-color .2s"
            oninput="sidebarSearch(this.value)"
            onfocus="this.style.borderColor='#1a3a8f'"
            onblur="this.style.borderColor='#e5e7eb'">
          <svg style="position:absolute;right:9px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:#9ca3af;pointer-events:none" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
      </div>
    </div>

    <!-- Catégories -->
    <div class="sidebar-block">
      <div class="sidebar-block__title">Catégories</div>
      <div class="sidebar-block__body">
        <a class="filter-cat ${active('index.html')}" href="index.html">Tous les produits <span class="filter-cat__count">24</span></a>
        <a class="filter-cat ${active('ordinateurs.html')}" href="ordinateurs.html">Ordinateurs <span class="filter-cat__count">6</span></a>
        <a class="filter-cat ${active('composants.html')}" href="composants.html">Composants <span class="filter-cat__count">4</span></a>
        <a class="filter-cat ${active('peripheriques.html')}" href="peripheriques.html">Périphériques <span class="filter-cat__count">5</span></a>
        <a class="filter-cat ${active('reseau.html')}" href="reseau.html">Réseau <span class="filter-cat__count">4</span></a>
        <a class="filter-cat ${active('stockage.html')}" href="stockage.html">Stockage <span class="filter-cat__count">5</span></a>
        <a class="filter-cat ${active('ecrans.html')}" href="ecrans.html">Écrans <span class="filter-cat__count">4</span></a>
        <a class="filter-cat ${active('protection.html')}" href="protection.html">Protection <span class="filter-cat__count">3</span></a>
        <a class="filter-cat ${active('reconditionnes.html')}" href="reconditionnes.html">Reconditionnés <span class="filter-cat__count">8</span></a>
        <a class="filter-cat ${active('promotions.html')}" href="promotions.html">Promotions 🔥</a>
        <a class="filter-cat ${active('services.html')}" href="services.html">Services 🛠️</a>
      </div>
    </div>

    <!-- Prix -->
    <div class="sidebar-block">
      <div class="sidebar-block__title">Prix</div>
      <div class="sidebar-block__body">
        <div class="filter-price">
          <label>Budget maximum : <strong id="sidebar-price-val">3 000 €</strong></label>
          <input type="range" min="0" max="3000" value="3000" step="50"
            oninput="sidebarFilterPrice(this.value)">
          <div class="filter-price__vals"><span>0 €</span><span>3 000 €</span></div>
        </div>
      </div>
    </div>

    <!-- État -->
    <div class="sidebar-block">
      <div class="sidebar-block__title">État</div>
      <div class="sidebar-block__body">
        <div class="filter-check"><label><input type="checkbox" checked onchange="sidebarApplyFilters()"> Neuf</label></div>
        <div class="filter-check"><label><input type="checkbox" checked onchange="sidebarApplyFilters()"> Reconditionné Grade A</label></div>
        <div class="filter-check"><label><input type="checkbox" checked onchange="sidebarApplyFilters()"> Reconditionné Grade B</label></div>
      </div>
    </div>

    <!-- Marques -->
    <div class="sidebar-block">
      <div class="sidebar-block__title">Marques</div>
      <div class="sidebar-block__body">
        <label class="filter-brand"><input type="checkbox" checked onchange="sidebarApplyFilters()"> Toutes</label>
        <label class="filter-brand"><input type="checkbox" onchange="sidebarApplyFilters()" data-brand="asus"> Asus</label>
        <label class="filter-brand"><input type="checkbox" onchange="sidebarApplyFilters()" data-brand="lenovo"> Lenovo</label>
        <label class="filter-brand"><input type="checkbox" onchange="sidebarApplyFilters()" data-brand="dell"> Dell</label>
        <label class="filter-brand"><input type="checkbox" onchange="sidebarApplyFilters()" data-brand="hp"> HP</label>
        <label class="filter-brand"><input type="checkbox" onchange="sidebarApplyFilters()" data-brand="samsung"> Samsung</label>
        <label class="filter-brand"><input type="checkbox" onchange="sidebarApplyFilters()" data-brand="tp-link"> TP-Link</label>
      </div>
    </div>

  </aside>`;

  /* ── Injection sidebar sur pages non-index ── */
  function injectSidebar() {
    if (IS_INDEX) { wireSearch(); return; }
    if (document.getElementById('shared-sidebar')) { wireSearch(); return; }

    const anchor = document.getElementById('quick-cats-bar') || document.querySelector('.nav-bar');
    if (!anchor) { wireSearch(); return; }

    const footer = document.querySelector('footer');

    // Collecte les éléments entre anchor et footer
    const toWrap = [];
    let el = anchor.nextElementSibling;
    while (el && el !== footer) {
      toWrap.push(el);
      el = el.nextElementSibling;
    }
    if (toWrap.length === 0) { wireSearch(); return; }

    // Layout wrapper — styles gérés par CSS .page-layout (pas d'inline pour ne pas bloquer les media queries)
    const layout = document.createElement('div');
    layout.className = 'page-layout';

    // Sidebar
    const sidebarWrap = document.createElement('div');
    sidebarWrap.innerHTML = SIDEBAR_HTML;
    layout.appendChild(sidebarWrap.firstElementChild);

    // Zone contenu
    const content = document.createElement('div');
    content.className = 'products-zone';
    content.style.minWidth = '0';
    toWrap.forEach(node => content.appendChild(node));
    layout.appendChild(content);

    anchor.insertAdjacentElement('afterend', layout);

    // MutationObserver : ré-applique filtres quand produits chargés dynamiquement
    // Debounce 200ms — évite les appels répétés quand CRO/catalog insèrent des éléments
    let _sidebarTimer;
    const observer = new MutationObserver(() => {
      clearTimeout(_sidebarTimer);
      _sidebarTimer = setTimeout(sidebarApplyFilters, 200);
    });
    observer.observe(content, { childList: true, subtree: true });

    wireSearch();
  }

  /* ── Connecte la barre de recherche header ── */
  function wireSearch() {
    const inputs = [
      document.getElementById('searchInput'),
      document.getElementById('search-input')
    ].filter(Boolean);

    inputs.forEach(input => {
      input.addEventListener('input', function () {
        sidebarSearch(this.value);
        const sb = document.getElementById('sidebar-search');
        if (sb && sb !== this) sb.value = this.value;
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') sidebarSearch(this.value);
      });
    });
  }

  /* ── API globale filtres ── */
  window.sidebarSearch = function (q) {
    const sb = document.getElementById('sidebar-search');
    if (sb) sb.value = q;
    const hi = document.getElementById('searchInput') || document.getElementById('search-input');
    if (hi && hi !== sb) hi.value = q;
    sidebarApplyFilters();
  };

  window.sidebarFilterPrice = function (val) {
    const lbl = document.getElementById('sidebar-price-val');
    if (lbl) lbl.textContent = Number(val).toLocaleString('fr-FR') + ' €';
    sidebarApplyFilters();
  };

  window.sidebarApplyFilters = function () {
    const query = (
      document.getElementById('sidebar-search')?.value ||
      document.getElementById('searchInput')?.value ||
      document.getElementById('search-input')?.value || ''
    ).toLowerCase().trim();

    const maxPrice = parseInt(
      document.querySelector('#shared-sidebar input[type=range]')?.value || 3000
    );

    const checks = document.querySelectorAll('#shared-sidebar .filter-check input[type=checkbox]');
    const allowNeuf   = checks[0]?.checked ?? true;
    const allowGradeA = checks[1]?.checked ?? true;
    const allowGradeB = checks[2]?.checked ?? true;

    const brandChecks = document.querySelectorAll('#shared-sidebar .filter-brand input[data-brand]');
    const activeBrands = [...brandChecks].filter(c => c.checked).map(c => c.dataset.brand);

    // Early-return si tous les filtres sont à leurs valeurs par défaut — pas de travail nécessaire
    if (!query && maxPrice >= 3000 && allowNeuf && allowGradeA && allowGradeB && activeBrands.length === 0) return;

    const cards = [...document.querySelectorAll('.product-card')];

    function processCard(card) {
      const title  = (card.querySelector('h3, .card-title')?.textContent || '').toLowerCase();
      const desc   = (card.querySelector('.card-subtitle, .text-sm, p')?.textContent || '').toLowerCase();
      const brand  = (card.querySelector('.card-brand, .product-badge')?.textContent || '').toLowerCase();
      const priceRaw = card.querySelector('.price-main, [class*="price-main"]')?.childNodes[0]?.textContent?.trim() || '0';
      const price = parseFloat(priceRaw.replace(/\s/g, '').replace(',', '.')) || 0;
      const isReco   = brand.includes('reco') || title.includes('reco') || card.dataset.cat === 'reconditionnes';
      const isGradeA = (brand + title).includes('grade a');
      const isGradeB = (brand + title).includes('grade b');
      const isNeuf   = !isReco;
      const matchQuery = !query || title.includes(query) || desc.includes(query) || brand.includes(query);
      const matchPrice = price === 0 || price <= maxPrice;
      const matchState = (isNeuf && allowNeuf) || (isGradeA && allowGradeA) ||
                         (isGradeB && allowGradeB) || (isReco && !isGradeA && !isGradeB && allowGradeA);
      const matchBrand = activeBrands.length === 0 ||
                         activeBrands.some(b => brand.includes(b) || title.includes(b));
      card.style.display = (matchQuery && matchPrice && matchState && matchBrand) ? '' : 'none';
    }

    // Chunk processing — évite long tasks (234 cartes × DOM reads)
    let i = 0;
    function chunk() {
      const end = Math.min(i + 30, cards.length);
      for (; i < end; i++) processCard(cards[i]);
      if (i < cards.length) {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(chunk, { timeout: 500 });
        } else {
          setTimeout(chunk, 0);
        }
      }
    }
    chunk();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSidebar);
  } else {
    injectSidebar();
  }

})();
