// admin/js/layout.js
function injectSidebar() {
  const page = window.location.pathname;

  const SIDEBAR_HTML = `
  <aside class="admin-sidebar">
    <div class="admin-sidebar__logo">Info Experts <span>Admin</span></div>
    <nav class="admin-nav">
      <div class="section">Vue d'ensemble</div>
      <a href="/admin/" data-path="/admin/,/admin/index.html">📊 Dashboard</a>

      <div class="section">Catalogue</div>
      <a href="/admin/products/" data-path="/admin/products/">📦 Produits</a>
      <a href="/admin/categories/" data-path="/admin/categories/">🗂️ Catégories</a>

      <div class="section">Ventes</div>
      <a href="/admin/orders/" data-path="/admin/orders/">🛒 Commandes</a>
      <a href="/admin/customers/" data-path="/admin/customers/">👥 Clients</a>
      <a href="/admin/invoices/" data-path="/admin/invoices/">🧾 Factures</a>

      <div class="section">Marketing</div>
      <a href="/admin/promotions/" data-path="/admin/promotions/">🏷️ Promotions</a>
      <a href="/admin/coupons/" data-path="/admin/coupons/">🎫 Codes promo</a>

      <div class="section">Inventaire</div>
      <a href="/admin/stock/" data-path="/admin/stock/">📦 Stock</a>

      <div class="section">Pricing</div>
      <a href="/admin/pricing/" data-path="/admin/pricing/">💰 Prix Comores</a>

      <div class="section">Paramètres</div>
      <a href="/admin/backups/" data-path="/admin/backups/">💾 Sauvegardes</a>
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
}

document.addEventListener('DOMContentLoaded', injectSidebar);
