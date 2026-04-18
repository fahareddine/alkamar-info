// Galerie produit — swipe tactile + navigation clavier
(function () {
  const VIEW_LABELS = ['Vue principale', 'Vue de côté', 'Détails produit', 'Vue arrière', 'Vue packaging'];

  function getLabel(index, productName) {
    return `${productName} — ${VIEW_LABELS[index] || 'Vue ' + (index + 1)}`;
  }

  function thumbs() {
    return [...document.querySelectorAll('.gallery__thumb')];
  }

  function currentIdx() {
    return thumbs().findIndex(t => t.classList.contains('active'));
  }

  function goTo(idx) {
    const all = thumbs();
    if (idx < 0 || idx >= all.length || idx === currentIdx()) return;
    const thumb = all[idx];
    const img = thumb.querySelector('img');
    if (typeof window.switchImg === 'function') window.switchImg(img.src, img.alt, thumb);
  }

  function initGallery() {
    const mainEl = document.querySelector('.gallery__main');
    if (!mainEl || mainEl._galleryInited) return;
    mainEl._galleryInited = true;

    let startX = 0;

    mainEl.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
    }, { passive: true });

    mainEl.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < 48) return;
      goTo(dx < 0 ? currentIdx() + 1 : currentIdx() - 1);
    }, { passive: true });

    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!document.querySelector('.gallery__main')) return;
      if (e.key === 'ArrowRight') goTo(currentIdx() + 1);
      if (e.key === 'ArrowLeft') goTo(currentIdx() - 1);
    });
  }

  // Observe l'injection du HTML produit (fetch async)
  const target = document.getElementById('product-content') || document.body;
  const observer = new MutationObserver(() => {
    if (document.querySelector('.gallery__main')) {
      observer.disconnect();
      initGallery();
    }
  });
  observer.observe(target, { childList: true, subtree: true });

  window.ProductGallery = { getLabel, initGallery };
})();
