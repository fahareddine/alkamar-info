// js/cart-ui.js — UI Drawer panier
(function () {
  'use strict';

  let drawerEl, overlayEl;

  function init() {
    injectDrawer();
    drawerEl  = document.getElementById('cart-drawer');
    overlayEl = document.getElementById('cart-overlay');

    overlayEl?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    // Bind explicite [data-cart-open]
    document.querySelectorAll('[data-cart-open]').forEach(btn =>
      btn.addEventListener('click', open)
    );
    // Bind automatique : tout lien/bouton header contenant un cart-badge
    document.querySelectorAll('.header__action').forEach(el => {
      if (el.querySelector('.cart-badge')) {
        el.setAttribute('href', '#');
        el.addEventListener('click', e => { e.preventDefault(); open(); });
      }
    });
    window.addEventListener('cart:updated', () => render());
    render();
  }

  function injectDrawer() {
    if (document.getElementById('cart-drawer')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="cart-overlay" class="cart-overlay"></div>
      <div id="cart-drawer" class="cart-drawer" role="dialog" aria-label="Panier">
        <div class="cart-drawer__header">
          <span>🛒 Mon Panier</span>
          <button class="cart-drawer__close" onclick="CartUI.close()">✕</button>
        </div>
        <div class="cart-drawer__body" id="cart-drawer-body"></div>
        <div class="cart-drawer__footer" id="cart-drawer-footer"></div>
      </div>`);
  }

  function preventBodyScroll(e) {
    // Autorise scroll uniquement dans la zone scrollable du panier
    if (!e.target.closest('.cart-drawer__body')) e.preventDefault();
  }

  function open() {
    render();
    const scrollY = window.scrollY;
    document.body.dataset.cartScrollY = scrollY;
    document.body.style.top = `-${scrollY}px`;
    document.body.classList.add('cart-open');
    // Bloque touchmove sur tout sauf le body du drawer (Android Chrome)
    document.addEventListener('touchmove', preventBodyScroll, { passive: false });
    drawerEl?.classList.add('open');
    overlayEl?.classList.add('open');
  }

  function close() {
    const scrollY = parseInt(document.body.dataset.cartScrollY || '0', 10);
    document.body.classList.remove('cart-open');
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
    document.removeEventListener('touchmove', preventBodyScroll);
    drawerEl?.classList.remove('open');
    overlayEl?.classList.remove('open');
  }

  function render() {
    const items = typeof Cart !== 'undefined' ? Cart.load() : [];
    const count = items.reduce((s, i) => s + (i.qty || 1), 0);
    const total = items.reduce((s, i) => s + (i.price_eur || 0) * (i.qty || 1), 0);

    document.querySelectorAll('.cart-badge').forEach(b => {
      b.textContent = count;
      if (count > 0) {
        b.classList.add('bump');
        setTimeout(() => b.classList.remove('bump'), 300);
      }
    });

    const body   = document.getElementById('cart-drawer-body');
    const footer = document.getElementById('cart-drawer-footer');
    if (!body || !footer) return;

    if (!items.length) {
      body.innerHTML = `<div class="cart-drawer__empty">
        <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" width="48" height="48" style="color:#d1d5db;margin:0 auto 12px;display:block"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>
        <p>Votre panier est vide</p>
        <button class="btn-continue-shopping" onclick="CartUI.close()">Continuer les achats</button>
      </div>`;
      footer.innerHTML = '';
      return;
    }

    body.innerHTML = items.map(item => `
      <div class="cart-item">
        <img class="cart-item__img" src="${item.main_image_url || item.image || ''}" alt="${item.name || ''}" onerror="this.style.display='none'">
        <div class="cart-item__info">
          <div class="cart-item__name">${item.name || ''}</div>
          <div class="cart-item__price">${((item.price_eur||0)*(item.qty||1)).toFixed(2).replace('.',',')} €</div>
          <div class="cart-item__qty">
            <button class="cart-qty-btn" onclick="CartUI.decrement('${item.id}')">−</button>
            <span class="cart-qty-val">${item.qty}</span>
            <button class="cart-qty-btn" onclick="CartUI.increment('${item.id}')">+</button>
          </div>
        </div>
        <button class="cart-item__remove" onclick="CartUI.removeItem('${item.id}')" title="Retirer">🗑</button>
      </div>`).join('');

    footer.innerHTML = `
      <div class="cart-total-line">
        <span>Total</span>
        <span class="total-eur">${total.toFixed(2).replace('.',',')} €</span>
      </div>
      <button class="btn-checkout" onclick="CartUI.checkout()">
        <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
        Payer maintenant — ${total.toFixed(2).replace('.',',')} €
      </button>
      <button class="btn-continue-shopping" onclick="CartUI.close()">← Continuer les achats</button>`;
  }

  function removeItem(id) {
    if (typeof Cart !== 'undefined') Cart.remove(id);
    render();
  }

  function increment(id) {
    if (typeof Cart !== 'undefined') {
      const item = Cart.load().find(i => i.id === id);
      if (item) Cart.updateQty(id, (item.qty || 1) + 1);
    }
    render();
  }

  function decrement(id) {
    if (typeof Cart !== 'undefined') {
      const item = Cart.load().find(i => i.id === id);
      if (item) Cart.updateQty(id, (item.qty || 1) - 1);
    }
    render();
  }

  async function checkout() {
    const items = typeof Cart !== 'undefined' ? Cart.load() : [];
    if (!items.length) return;

    // Gate auth — redirige vers connexion si non connecté
    if (typeof AccountGuard !== 'undefined') {
      let proceed = false;
      await AccountGuard.requireAuth(() => { proceed = true; });
      if (!proceed) return;
    }
    await _doCheckout(items);
  }

  async function _doCheckout(items) {
    const btn = document.querySelector('.btn-checkout');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Chargement…'; }

    // Timeout 15s — évite skeleton infini
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const authHeaders = typeof AccountGuard !== 'undefined' ? await AccountGuard.getAuthHeaders() : {};
      const res = await fetch('/api/orders?action=checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ items }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();

      if (data.url) {
        // ── Redirect Checkout Stripe ─────────────────────────────────────────
        // Si le site est dans une iframe (ex: info-experts.fr), on redirige
        // la fenêtre parente pour éviter le blocage Stripe dans l'iframe.
        const stripeUrl = data.url;
        try {
          if (window.top && window.top !== window.self) {
            // Contexte iframe → redirige la fenêtre parente
            window.top.location.href = stripeUrl;
          } else {
            window.location.href = stripeUrl;
          }
        } catch(crossOriginError) {
          // Cross-origin restriction → ouvre dans un nouvel onglet
          window.open(stripeUrl, '_blank', 'noopener');
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🔗 Cliquez ici si la page ne s\'ouvre pas';
            btn.onclick = () => window.open(stripeUrl, '_blank', 'noopener');
          }
        }
      } else {
        _showCheckoutError(btn, data.error || 'Erreur paiement');
      }
    } catch(e) {
      clearTimeout(timeout);
      const msg = e.name === 'AbortError'
        ? 'Le paiement n\'a pas répondu à temps. Réessayez.'
        : 'Erreur réseau. Vérifiez votre connexion.';
      _showCheckoutError(btn, msg);
    }
  }

  function _showCheckoutError(btn, msg) {
    // Efface le skeleton/loading, affiche l'erreur avec bouton Réessayer
    const footer = document.getElementById('cart-drawer-footer');
    if (footer) {
      footer.insertAdjacentHTML('afterbegin',
        `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px;color:#dc2626">
          ⚠️ ${msg}
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="CartUI.checkout()" style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit">↻ Réessayer</button>
          </div>
        </div>`
      );
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '🔒 Payer maintenant'; }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  window.CartUI = { open, close, render, removeItem, increment, decrement, checkout };
})();
