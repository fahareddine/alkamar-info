// admin/js/layout.js
function injectSidebar() {
  const page = window.location.pathname;

  const SIDEBAR_HTML = `
  <aside class="admin-sidebar">
    <div class="admin-sidebar__logo">Alkamar <span>Admin</span></div>
    <nav class="admin-nav">
      <div class="section">Vue d'ensemble</div>
      <a href="/admin/" data-path="/admin/,/admin/index.html">📊 Dashboard</a>

      <div class="section">Catalogue</div>
      <a href="/admin/products/" data-path="/admin/products/">📦 Produits</a>
      <a href="/admin/categories/" data-path="/admin/categories/">🗂️ Catégories</a>

      <div class="section">Ventes</div>
      <a href="/admin/orders/" data-path="/admin/orders/">🛒 Commandes</a>
      <a href="/admin/customers/" data-path="/admin/customers/">👥 Clients</a>

      <div class="section">Paramètres</div>
      <a href="/admin/users/" data-path="/admin/users/">🔑 Utilisateurs</a>
      <a href="#" id="logout-btn">🚪 Déconnexion</a>
    </nav>
  </aside>`;

  const layout = document.querySelector('.admin-layout');
  if (layout) layout.insertAdjacentHTML('afterbegin', SIDEBAR_HTML);

  document.querySelectorAll('.admin-nav a[data-path]').forEach(a => {
    const paths = a.dataset.path.split(',');
    if (paths.some(p => page === p || page.startsWith(p))) {
      a.classList.add('active');
    }
  });

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); adminAuth.logout(); });
}

document.addEventListener('DOMContentLoaded', injectSidebar);
