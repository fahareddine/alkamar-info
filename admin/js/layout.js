// admin/js/layout.js
function injectSidebar() {
  const page = window.location.pathname;

  const SIDEBAR_HTML = `
  <aside class="admin-sidebar">
    <div class="admin-sidebar__logo">Info Experts <span>Admin</span></div>
    <nav class="admin-nav">
      <div class="section">Vue d'ensemble</div>
      <a href="/admin/" data-path="/admin/,/admin/index.html">📊 Dashboard</a>
      <a href="#" id="global-search-btn">🔍 Rechercher <kbd style="margin-left:auto;font-size:10px;background:rgba(255,255,255,.08);padding:2px 6px;border-radius:4px;border:1px solid var(--admin-border)">Ctrl K</kbd></a>

      <div class="section">Catalogue</div>
      <a href="/admin/products/" data-path="/admin/products/">📦 Produits</a>
      <a href="/admin/categories/" data-path="/admin/categories/">🗂️ Catégories</a>

      <div class="section">Ventes</div>
      <a href="/admin/orders/" data-path="/admin/orders/" data-badge="orders_pending">🛒 Commandes</a>
      <a href="/admin/relances/" data-path="/admin/relances/" data-badge="unpaid">💸 Relances impayés</a>
      <a href="/admin/customers/" data-path="/admin/customers/">👥 Clients</a>
      <a href="/admin/invoices/" data-path="/admin/invoices/">🧾 Factures</a>

      <div class="section">Marketing</div>
      <a href="/admin/reviews/" data-path="/admin/reviews/" data-badge="reviews_pending">⭐ Avis & Alertes</a>
      <a href="/admin/promotions/" data-path="/admin/promotions/">🏷️ Promotions</a>
      <a href="/admin/coupons/" data-path="/admin/coupons/">🎫 Codes promo</a>

      <div class="section">Inventaire</div>
      <a href="/admin/stock/" data-path="/admin/stock/" data-badge="stock_out">📦 Stock</a>

      <div class="section">Pricing</div>
      <a href="/admin/pricing/" data-path="/admin/pricing/">💰 Prix Comores</a>

      <div class="section">Paramètres</div>
      <a href="/admin/backups/" data-path="/admin/backups/">💾 Sauvegardes</a>
      <a href="/admin/journal/" data-path="/admin/journal/">📜 Journal d'activité</a>
      <a href="/admin/users/" data-path="/admin/users/">🔑 Utilisateurs</a>
      <a href="#" id="logout-btn">🚪 Déconnexion</a>
    </nav>
  </aside>`;

  const TOPBAR_HTML = `
  <header class="admin-topbar">
    <button class="admin-topbar__burger" id="admin-burger" aria-label="Ouvrir le menu" aria-expanded="false">☰</button>
    <div class="admin-topbar__title">Info Experts <span>Admin</span></div>
  </header>
  <div class="admin-overlay" id="admin-overlay"></div>`;

  const layout = document.querySelector('.admin-layout');
  if (layout) {
    layout.insertAdjacentHTML('afterbegin', SIDEBAR_HTML);
    layout.insertAdjacentHTML('afterbegin', TOPBAR_HTML);
  }

  document.querySelectorAll('.admin-nav a[data-path]').forEach(a => {
    const paths = a.dataset.path.split(',');
    if (paths.some(p => page === p || page.startsWith(p))) {
      a.classList.add('active');
    }
  });

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); adminAuth.logout(); });

  // ── Drawer mobile ──
  const sidebar = document.querySelector('.admin-sidebar');
  const burger  = document.getElementById('admin-burger');
  const overlay = document.getElementById('admin-overlay');

  function setDrawer(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', open);
    overlay.classList.toggle('is-visible', open);
    document.body.classList.toggle('admin-drawer-open', open);
    if (burger) burger.setAttribute('aria-expanded', String(open));
  }

  if (burger)  burger.addEventListener('click', () => setDrawer(!sidebar.classList.contains('is-open')));
  if (overlay) overlay.addEventListener('click', () => setDrawer(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });
  // Ferme le drawer quand on navigue
  document.querySelectorAll('.admin-nav a[data-path]').forEach(a => {
    a.addEventListener('click', () => setDrawer(false));
  });

  loadNavBadges();
  initGlobalSearch();
}

/* ── Badges compteurs dans le menu (commandes en attente, avis, impayés, ruptures) ── */
async function loadNavBadges() {
  if (typeof api === 'undefined') return;
  try {
    const c = await api.get('/api/orders?_route=counts');
    if (!c) return;
    document.querySelectorAll('.admin-nav a[data-badge]').forEach(a => {
      const n = c[a.dataset.badge] || 0;
      let b = a.querySelector('.nav-count');
      if (n > 0) {
        if (!b) {
          b = document.createElement('span');
          b.className = 'nav-count';
          a.appendChild(b);
        }
        b.textContent = n > 99 ? '99+' : String(n);
      } else if (b) {
        b.remove();
      }
    });
  } catch (e) { /* badges non bloquants */ }
}

/* ── Recherche globale Ctrl+K (produits + commandes) ── */
function initGlobalSearch() {
  const MODAL_HTML = `
  <div class="gs-overlay" id="gs-overlay">
    <div class="gs-box" role="dialog" aria-label="Recherche globale">
      <input type="text" id="gs-input" class="gs-input" placeholder="Rechercher un produit, une commande, un client…" autocomplete="off">
      <div class="gs-results" id="gs-results"></div>
      <div class="gs-hint">↵ ouvrir · Échap fermer</div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', MODAL_HTML);

  const overlay = document.getElementById('gs-overlay');
  const input = document.getElementById('gs-input');
  const results = document.getElementById('gs-results');
  let cache = null;
  let debounce = null;

  function open() {
    overlay.classList.add('is-open');
    input.value = '';
    results.replaceChildren();
    setTimeout(() => input.focus(), 50);
  }
  function close() { overlay.classList.remove('is-open'); }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    if (e.key === 'Escape') close();
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  const btn = document.getElementById('global-search-btn');
  if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); open(); });

  async function loadData() {
    if (cache) return cache;
    const [products, orders] = await Promise.all([
      api.get('/api/products?status=all&limit=400').catch(() => []),
      api.get('/api/orders?limit=100').catch(() => []),
    ]);
    cache = {
      products: (products || []).map(p => ({
        type: '📦', label: p.name, sub: (p.brand || '') + (p.price_eur ? ` · ${Number(p.price_eur).toFixed(2)} €` : ''),
        url: '/admin/products/edit.html?id=' + p.id,
        key: `${p.name} ${p.brand || ''} ${p.sku || ''}`.toLowerCase(),
      })),
      orders: (orders || []).map(o => ({
        type: '🛒', label: `Commande #${String(o.id).slice(0, 8).toUpperCase()}`,
        sub: `${o.customers?.name || o.customer_name || ''} · ${Number(o.total_eur).toFixed(2)} € · ${o.status}`,
        url: '/admin/orders/detail.html?id=' + o.id,
        key: `${o.id} ${o.customers?.name || ''} ${o.customer_name || ''} ${o.customer_email || ''}`.toLowerCase(),
      })),
    };
    return cache;
  }

  function render(items) {
    results.replaceChildren();
    if (!items.length) {
      const d = document.createElement('div');
      d.className = 'gs-empty';
      d.textContent = 'Aucun résultat';
      results.appendChild(d);
      return;
    }
    items.slice(0, 12).forEach((item, i) => {
      const a = document.createElement('a');
      a.href = item.url;
      a.className = 'gs-item' + (i === 0 ? ' is-active' : '');
      const icon = document.createElement('span');
      icon.textContent = item.type;
      const txt = document.createElement('div');
      const label = document.createElement('div');
      label.className = 'gs-item__label';
      label.textContent = item.label;
      const sub = document.createElement('div');
      sub.className = 'gs-item__sub';
      sub.textContent = item.sub;
      txt.append(label, sub);
      a.append(icon, txt);
      results.appendChild(a);
    });
  }

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) { results.replaceChildren(); return; }
      const data = await loadData();
      const all = [...data.products, ...data.orders];
      render(all.filter(i => i.key.includes(q)));
    }, 150);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = results.querySelector('.gs-item');
      if (first) window.location.href = first.href;
    }
  });
}

document.addEventListener('DOMContentLoaded', injectSidebar);
