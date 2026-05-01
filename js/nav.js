/* nav.js — Navigation partagée Alkamar Info
   Injecte le nav-bar sur toutes les pages et gère le menu mobile */
(function () {

  const NAV_HTML = `
  <nav class="nav-bar" id="main-nav">
    <div class="nav-bar__inner">

      <div class="nav-item">
        <a href="ordinateurs.html" class="nav-item__btn" style="text-decoration:none">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          Ordinateurs
          <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>
        </a>
        <div class="nav-dropdown">
          <a href="ordinateurs.html?tab=portables">💻 PC Portables</a>
          <a href="ordinateurs.html?tab=bureau">🖥️ PC de Bureau</a>
          <a href="ordinateurs.html?tab=gaming">🎮 PC Gaming</a>
          <a href="ordinateurs.html?tab=toutunun">📺 PC Tout-en-un</a>
          <a href="ordinateurs.html?tab=reconditiones">♻️ Reconditionnés Grade A</a>
          <a href="ordinateurs.html?tab=minipc">📦 Mini PC</a>
        </div>
      </div>

      <div class="nav-item">
        <a href="composants.html" class="nav-item__btn" style="text-decoration:none">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
          Composants
          <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>
        </a>
        <div class="nav-dropdown">
          <a href="composants.html?tab=cpu">🔲 Processeurs CPU</a>
          <a href="composants.html?tab=cartemere">🖥️ Cartes mères</a>
          <a href="composants.html?tab=ram">💾 RAM / Mémoire</a>
          <a href="composants.html?tab=gpu">🎮 Cartes graphiques GPU</a>
          <a href="composants.html?tab=alimentation">⚡ Alimentations</a>
          <a href="composants.html?tab=boitier">📦 Boîtiers PC</a>
          <a href="composants.html?tab=refroidissement">❄️ Refroidissement</a>
        </div>
      </div>

      <div class="nav-item">
        <a href="peripheriques.html" class="nav-item__btn" style="text-decoration:none">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 4H3m18-4h-2M7 20H5a2 2 0 01-2-2v-2"/></svg>
          Périphériques
          <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>
        </a>
        <div class="nav-dropdown">
          <a href="peripheriques.html?tab=clavier">⌨️ Claviers</a>
          <a href="peripheriques.html?tab=souris">🖱️ Souris</a>
          <a href="peripheriques.html?tab=casque">🎧 Casques / Enceintes</a>
          <a href="peripheriques.html?tab=webcam">📷 Webcams</a>
          <a href="imprimantes.html" style="font-weight:800;color:var(--primary)">🖨️ Imprimantes →</a>
          <a href="imprimantes.html?tab=jet-encre" style="padding-left:24px;font-size:12px">↳ Jet d'encre</a>
          <a href="imprimantes.html?tab=multifonction" style="padding-left:24px;font-size:12px">↳ Multifonction</a>
          <a href="imprimantes.html?tab=laser" style="padding-left:24px;font-size:12px">↳ Laser</a>
          <a href="imprimantes.html?tab=matricielle" style="padding-left:24px;font-size:12px">↳ Matricielle</a>
          <a href="imprimantes.html?tab=thermique" style="padding-left:24px;font-size:12px">↳ Thermique</a>
          <a href="peripheriques.html?tab=onduleur">🔋 Onduleurs</a>
        </div>
      </div>

      <div class="nav-item">
        <a href="reseau.html" class="nav-item__btn" style="text-decoration:none">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/></svg>
          Réseau
          <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>
        </a>
        <div class="nav-dropdown">
          <a href="reseau.html?tab=routeur-wifi">📡 Routeurs WiFi</a>
          <a href="reseau.html?tab=routeur-4g5g">📶 Routeurs 4G/5G</a>
          <a href="reseau.html?tab=switch">🔀 Switches</a>
          <a href="reseau.html?tab=point-acces">📡 Points d'accès</a>
          <a href="reseau.html?tab=cable">🔌 Câbles réseau</a>
        </div>
      </div>

      <div class="nav-item">
        <a href="stockage.html" class="nav-item__btn" style="text-decoration:none">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"/></svg>
          Stockage
          <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>
        </a>
        <div class="nav-dropdown">
          <a href="stockage.html?tab=ssd-externe">💽 SSD Externes</a>
          <a href="stockage.html?tab=ssd-interne">💾 SSD Internes</a>
          <a href="stockage.html?tab=hdd">🗄️ Disques durs HDD</a>
          <a href="stockage.html?tab=cle-usb">🔑 Clés USB</a>
          <a href="stockage.html?tab=carte-memoire">📱 Cartes mémoire</a>
          <a href="stockage.html?tab=nas">🖥️ NAS</a>
        </div>
      </div>

      <div class="nav-item">
        <a href="ecrans.html" class="nav-item__btn" style="text-decoration:none">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M2 20h20"/></svg>
          Écrans
          <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>
        </a>
        <div class="nav-dropdown">
          <a href="ecrans.html?tab=ecran-fhd">🖥️ Écrans Full HD</a>
          <a href="ecrans.html?tab=ecran-4k">🔲 Écrans 4K</a>
          <a href="ecrans.html?tab=ecran-gaming">🎮 Écrans Gaming</a>
          <a href="ecrans.html?tab=ecran-reco">♻️ Écrans reconditionnés</a>
        </div>
      </div>

      <div class="nav-item">
        <a href="protection.html" class="nav-item__btn" style="text-decoration:none">
          🛡️ Protection
        </a>
      </div>

      <div class="nav-item">
        <a href="promotions.html" class="nav-item__btn" style="color:#f59e0b;font-weight:800;text-decoration:none">
          🔥 Promotions
        </a>
      </div>

      <div class="nav-item">
        <a href="reconditionnes.html" class="nav-item__btn" style="text-decoration:none">
          ♻️ Reconditionnés
        </a>
      </div>

      <div class="nav-item">
        <a href="services.html" class="nav-item__btn" style="text-decoration:none">
          🛠️ Services
        </a>
      </div>

    </div>
  </nav>`;

  const QUICK_CATS_HTML = `
  <div class="quick-cats" id="quick-cats-bar">
    <div class="quick-cats__inner">
      <a href="ordinateurs.html?tab=portables" class="quick-cat"><span class="icon">💻</span>PC Portables</a>
      <a href="ordinateurs.html?tab=bureau" class="quick-cat"><span class="icon">🖥️</span>PC Bureau</a>
      <a href="ordinateurs.html?tab=gaming" class="quick-cat"><span class="icon">🎮</span>Gaming</a>
      <a href="composants.html" class="quick-cat"><span class="icon">⚡</span>Composants</a>
      <a href="reseau.html" class="quick-cat"><span class="icon">📡</span>Réseau</a>
      <a href="stockage.html" class="quick-cat"><span class="icon">💾</span>Stockage</a>
      <a href="peripheriques.html" class="quick-cat"><span class="icon">🖱️</span>Périphériques</a>
      <a href="imprimantes.html" class="quick-cat"><span class="icon">🖨️</span>Imprimantes</a>
      <a href="ecrans.html" class="quick-cat"><span class="icon">📺</span>Écrans</a>
      <a href="protection.html" class="quick-cat"><span class="icon">🛡️</span>Protection</a>
      <a href="reconditionnes.html" class="quick-cat"><span class="icon">♻️</span>Reconditionnés</a>
      <a href="promotions.html" class="quick-cat"><span class="icon">🔥</span>Promotions</a>
      <a href="services.html" class="quick-cat"><span class="icon">🛠️</span>Services</a>
    </div>
  </div>`;

  /* ── Injection du nav ── */
  if (!document.getElementById('main-nav')) {
    const header = document.querySelector('.header');
    if (header) header.insertAdjacentHTML('afterend', NAV_HTML);
  }

  /* ── Injection des quick-cats ── */
  if (!document.getElementById('quick-cats-bar')) {
    const nav = document.getElementById('main-nav');
    if (nav) nav.insertAdjacentHTML('afterend', QUICK_CATS_HTML);
  }

  /* ── Marque le quick-cat actif selon l'URL courante ── */
  function setActiveQuickCat() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const param = new URLSearchParams(window.location.search).get('tab');
    document.querySelectorAll('#quick-cats-bar .quick-cat').forEach(cat => {
      const href = cat.getAttribute('href');
      const matchPage = href.startsWith(page);
      const matchParam = param ? href.includes('tab=' + param) : true;
      if (matchPage && matchParam) cat.classList.add('active');
    });
  }

  /* ── Initialisation du menu mobile ── */
  function initMobileMenu() {
    const toggleBtn = document.getElementById('menu-toggle-btn');
    const nav = document.getElementById('main-nav');
    if (!toggleBtn || !nav) return;

    /* Attributs ARIA initiaux */
    toggleBtn.setAttribute('aria-controls', 'main-nav');
    toggleBtn.setAttribute('aria-expanded', 'false');

    function closeMenu() {
      nav.classList.remove('is-open');
      nav.querySelectorAll('.nav-item').forEach(i => i.classList.remove('open'));
      toggleBtn.textContent = '☰';
      toggleBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = nav.classList.toggle('is-open');
      toggleBtn.textContent = isOpen ? '✕' : '☰';
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
      /* Bloque le scroll du body derrière le menu ouvert */
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    /* Dropdowns mobiles — toggle au clic */
    nav.querySelectorAll('.nav-item').forEach(item => {
      const btn = item.querySelector('.nav-item__btn');
      if (!btn || !item.querySelector('.nav-dropdown')) return;
      btn.addEventListener('click', (e) => {
        if (!nav.classList.contains('is-open')) return;
        e.preventDefault();
        item.classList.toggle('open');
        nav.querySelectorAll('.nav-item').forEach(other => {
          if (other !== item) other.classList.remove('open');
        });
      });
    });

    /* Ferme le menu après clic sur un lien de navigation */
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (nav.classList.contains('is-open')) closeMenu();
      });
    });

    /* Ferme le menu au clic en dehors */
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('is-open') && !nav.contains(e.target) && e.target !== toggleBtn) {
        closeMenu();
      }
    });

    /* Ferme le menu sur Escape */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        closeMenu();
        toggleBtn.focus();
      }
    });
  }

  /* ── Empêche href="#" de scroller la page vers le haut ── */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href="#"]');
    if (a) e.preventDefault();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initMobileMenu(); setActiveQuickCat(); });
  } else {
    initMobileMenu();
    setActiveQuickCat();
  }

  /* ── Injection search.js (non-bloquant) ── */
  if (!document.getElementById('alkamar-search-js')) {
    const _s = document.createElement('script');
    _s.id  = 'alkamar-search-js';
    _s.src = '/js/search.js';
    _s.defer = true;
    document.head.appendChild(_s);
  }

})();
