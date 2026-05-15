// admin/js/customers.js
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
async function loadCustomers() {
  const search = document.getElementById('search').value.trim();
  let url = '/api/customers?limit=50';
  if (search) url += `&search=${encodeURIComponent(search)}`;
  const customers = await api.get(url);
  const tbody = document.getElementById('customers-body');
  if (!customers || customers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--admin-muted)">Aucun client</td></tr>';
    return;
  }
  tbody.innerHTML = customers.map(c => `
    <tr>
      <td style="font-weight:600">${esc(c.name)}</td>
      <td style="color:var(--admin-muted)">${esc(c.email || '—')}</td>
      <td style="color:var(--admin-muted)">${esc(c.phone || '—')}</td>
      <td style="color:var(--admin-muted)">${esc(c.city || '—')}</td>
      <td style="font-size:12px;color:var(--admin-muted)">${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
    </tr>`).join('');
}

async function init() {
  await adminAuth.requireAuth();
  await loadCustomers();
  let t;
  document.getElementById('search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadCustomers, 300); });
}

init();
