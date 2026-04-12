// admin/js/dashboard.js
const STATUS_LABELS = {
  pending: 'En attente', confirmed: 'Confirmée',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée',
};

async function loadDashboard() {
  await adminAuth.requireAuth();
  const now = new Date();
  document.getElementById('month-label').textContent =
    now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  try {
    const stats = await api.get('/api/stats');
    document.getElementById('ca-eur').textContent =
      stats.ca.eur.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    document.getElementById('ca-kmf').textContent =
      stats.ca.kmf.toLocaleString('fr-FR') + ' KMF';
    document.getElementById('orders-total').textContent = stats.orders.total;
    document.getElementById('orders-pending').textContent = `${stats.orders.pending} en attente`;
    document.getElementById('stock-alerts').textContent = stats.stock_alerts.length;

    const tbody = document.getElementById('recent-orders-body');
    tbody.innerHTML = stats.recent_orders.length === 0
      ? '<tr><td colspan="4" style="text-align:center;color:var(--admin-muted);padding:16px">Aucune commande</td></tr>'
      : stats.recent_orders.map(o => `
          <tr>
            <td><a href="/admin/orders/detail.html?id=${o.id}">${o.customers?.name || '—'}</a></td>
            <td>${Number(o.total_eur).toFixed(2)} €</td>
            <td><span class="badge badge--${o.status}">${STATUS_LABELS[o.status] || o.status}</span></td>
            <td style="color:var(--admin-muted);font-size:12px">${new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
          </tr>`).join('');

    const stockBody = document.getElementById('stock-body');
    stockBody.innerHTML = stats.stock_alerts.length === 0
      ? '<tr><td colspan="2" style="text-align:center;color:var(--admin-muted);padding:16px">Aucune alerte</td></tr>'
      : stats.stock_alerts.map(p => `
          <tr>
            <td><a href="/admin/products/edit.html?id=${p.id}">${p.name}</a></td>
            <td style="color:${p.stock === 0 ? 'var(--admin-danger)' : 'var(--admin-warning)'};font-weight:700">${p.stock}</td>
          </tr>`).join('');
  } catch (e) {
    console.error('Dashboard error:', e);
  }
}

loadDashboard();
