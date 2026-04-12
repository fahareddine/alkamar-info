// admin/js/orders-list.js
const STATUS_LABELS = {
  pending: 'En attente', confirmed: 'Confirmée',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée',
};

async function loadOrders() {
  const status = document.getElementById('filter-status').value;
  let url = '/api/orders?limit=50';
  if (status) url += `&status=${status}`;
  const orders = await api.get(url);
  const tbody = document.getElementById('orders-body');
  if (!orders || orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--admin-muted)">Aucune commande</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td style="font-family:monospace;font-size:12px;color:var(--admin-muted)">${o.id.slice(0,8)}…</td>
      <td>${o.customers?.name || '—'}</td>
      <td>${Number(o.total_eur).toFixed(2)} €</td>
      <td><span class="badge badge--${o.status}">${STATUS_LABELS[o.status]}</span></td>
      <td style="font-size:13px;color:var(--admin-muted)">${new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
      <td><a href="/admin/orders/detail.html?id=${o.id}" class="btn btn--ghost btn--sm">Voir</a></td>
    </tr>`).join('');
}

async function init() {
  await adminAuth.requireAuth();
  await loadOrders();
  document.getElementById('filter-status').addEventListener('change', loadOrders);
}

init();
