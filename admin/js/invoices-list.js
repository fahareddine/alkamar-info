// admin/js/invoices-list.js

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function formatCurrency(amount) {
  if (amount == null) return '0,00 €';
  return Number(amount).toFixed(2).replace('.', ',') + ' €';
}

function formatKmf(amount) {
  if (amount == null) return '0 KMF';
  const num = Math.round(amount);
  return num.toLocaleString('fr-FR') + ' KMF';
}

function getStatusBadge(status) {
  const badges = {
    issued:    '<span class="badge badge--active">Émise</span>',
    paid:      '<span class="badge badge--success">Payée</span>',
    cancelled: '<span class="badge badge--archived">Annulée</span>',
  };
  return badges[status] || `<span class="badge">${esc(status)}</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

async function loadInvoices() {
  const statusFilter = document.getElementById('status-filter').value;
  const url = statusFilter
    ? `/api/invoices?limit=50&status=${encodeURIComponent(statusFilter)}`
    : '/api/invoices?limit=50';

  const data = await api.get(url);
  const tbody = document.getElementById('invoices-body');

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--admin-muted)">Aucune facture</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(invoice => `
    <tr>
      <td style="font-weight:600;letter-spacing:.05em">${esc(invoice.invoice_number)}</td>
      <td>${esc(invoice.customers?.name || '—')}</td>
      <td>${formatCurrency(invoice.total_eur)}</td>
      <td>${formatKmf(invoice.total_kmf)}</td>
      <td>${formatCurrency(invoice.discount_eur)}</td>
      <td>${getStatusBadge(invoice.status)}</td>
      <td style="font-size:13px;color:var(--admin-muted)">${formatDate(invoice.issued_at)}</td>
      <td><a href="/admin/orders/detail.html?id=${esc(invoice.order_id)}" style="color:var(--primary)">Voir commande</a></td>
    </tr>`
  ).join('');
}

async function init() {
  await adminAuth.requireAuth();

  const statusFilter = document.getElementById('status-filter');
  statusFilter.addEventListener('change', loadInvoices);

  await loadInvoices();
}

init();
