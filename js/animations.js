(function () {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -16px 0px' });

  var mo = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.classList && node.classList.contains('product-card')) {
          node.classList.add('card-reveal');
          io.observe(node);
        }
        var cards = node.querySelectorAll && node.querySelectorAll('.product-card');
        if (cards) cards.forEach(function (c) { c.classList.add('card-reveal'); io.observe(c); });
      });
    });
  });

  mo.observe(document.body, { childList: true, subtree: true });
})();
