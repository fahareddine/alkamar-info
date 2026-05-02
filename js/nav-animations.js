// js/nav-animations.js — Animations GSAP du menu (chargé après nav.js)
(function () {
  'use strict';

  // Attendre GSAP + DOM
  function init() {
    if (typeof gsap === 'undefined') return; // GSAP non chargé

    const nav       = document.getElementById('main-nav');
    const toggleBtn = document.getElementById('menu-toggle-btn');
    const quickCats = document.getElementById('quick-cats-bar');
    const header    = document.querySelector('.header');

    /* ── 1. Animation menu mobile ──────────────────────────────────── */
    if (nav && toggleBtn) {

      // Observe l'ajout/suppression de .is-open
      const observer = new MutationObserver(mutations => {
        mutations.forEach(m => {
          if (m.attributeName !== 'class') return;
          const isOpen = nav.classList.contains('is-open');
          const links  = nav.querySelectorAll('.nav-item__btn, .nav-item > a');

          if (isOpen) {
            // Kill animations en cours
            gsap.killTweensOf([nav, links]);

            // Slide-down + fade du menu
            gsap.fromTo(nav,
              { opacity: 0, y: -12 },
              { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out' }
            );

            // Stagger des liens de navigation
            gsap.fromTo(links,
              { opacity: 0, x: -16 },
              {
                opacity: 1, x: 0,
                duration: 0.24,
                stagger: 0.04,
                ease: 'power2.out',
                delay: 0.08,
              }
            );

          } else {
            // Slide-up + fade à la fermeture
            gsap.to(nav, { opacity: 0, y: -8, duration: 0.2, ease: 'power2.in' });
          }
        });
      });

      observer.observe(nav, { attributes: true });

      /* ── Animation bouton hamburger ── */
      toggleBtn.addEventListener('click', () => {
        const isOpen = nav.classList.contains('is-open');
        gsap.to(toggleBtn, {
          rotation:  isOpen ? 90 : 0,
          scale:     isOpen ? 1 : 0.85,
          duration:  0.2,
          ease:      'back.out(1.7)',
          onComplete: () => gsap.set(toggleBtn, { scale: 1, rotation: 0 }),
        });
      });
    }

    /* ── 2. Animations dropdowns desktop ──────────────────────────── */
    document.querySelectorAll('.nav-item').forEach(item => {
      const dropdown = item.querySelector('.nav-dropdown');
      if (!dropdown) return;

      // Pré-régler le dropdown pour les animations
      gsap.set(dropdown, { opacity: 0, y: -6, display: 'none' });

      item.addEventListener('mouseenter', () => {
        if (window.innerWidth < 900) return; // mobile géré autrement
        gsap.killTweensOf(dropdown);
        gsap.to(dropdown, {
          display: 'block',
          opacity: 1,
          y: 0,
          duration: 0.22,
          ease: 'power2.out',
        });
        // Stagger liens dropdown
        const links = dropdown.querySelectorAll('a');
        gsap.fromTo(links,
          { opacity: 0, x: -8 },
          { opacity: 1, x: 0, duration: 0.18, stagger: 0.03, ease: 'power2.out' }
        );
      });

      item.addEventListener('mouseleave', () => {
        if (window.innerWidth < 900) return;
        gsap.killTweensOf(dropdown);
        gsap.to(dropdown, {
          opacity: 0,
          y: -6,
          duration: 0.16,
          ease: 'power2.in',
          onComplete: () => gsap.set(dropdown, { display: 'none' }),
        });
      });
    });

    /* ── 3. Animation entrée du header au scroll ──────────────────── */
    if (header) {
      let lastScrollY = 0;
      window.addEventListener('scroll', () => {
        const y = window.scrollY;
        if (y > 80 && lastScrollY <= 80) {
          gsap.to(header, { boxShadow: '0 4px 20px rgba(0,0,0,.35)', duration: 0.3 });
        } else if (y <= 80 && lastScrollY > 80) {
          gsap.to(header, { boxShadow: 'none', duration: 0.3 });
        }
        lastScrollY = y;
      }, { passive: true });
    }

    /* ── 4. Entrée animée des quick-cats au premier chargement ────── */
    if (quickCats) {
      const items = quickCats.querySelectorAll('.quick-cat');
      gsap.from(items, {
        opacity: 0,
        y: 10,
        duration: 0.4,
        stagger: 0.04,
        ease: 'power2.out',
        delay: 0.3,
      });
    }
  }

  // Charger GSAP depuis CDN puis init
  function loadGsap() {
    if (typeof gsap !== 'undefined') { init(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js';
    s.onload = init;
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGsap);
  } else {
    loadGsap();
  }
})();
