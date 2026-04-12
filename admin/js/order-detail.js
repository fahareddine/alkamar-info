// admin/js/order-detail.js
const orderId = new URLSearchParams(window.location.search).get('id');

async function loadOrder() {
  const o = await api.get(`/api/orders/${orderId}`);
  if (!o) return;
  document.getElementById('page-title').textContent = `Commande #${o.id.slice(0,8)}`;
  document.getElementById('status-select').value = o.status;
  document.getElementById('notes').value = o.notes || '';

  document.getElementById('customer-info').innerHTML = o.customers ? `
    <p style="font-weight:600">${o.customers.name}</p>
    <p style="color:var(--admin-muted);font-size:13px">${o.customers.email || ''}</p>
    <p style="color:var(--admin-muted);font-size:13px">${o.customers.phone || ''}</p>
    <p style="color:var(--admin-muted);font-size:13px">${o.customers.city || ''}</p>
  ` : '—';

  document.getElementById('order-items').innerHTML = (o.order_items || []).map(item => `
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--admin-border)">
      <div>
        <div style="font-weight:600">${item.product_snapshot?.name || item.products?.name || '—'}</div>
        <div style="font-size:12px;color:var(--admin-muted)">Qté : ${item.quantity}</div>
      </div>
      <div style="text-align:right">
        <div>${(Number(item.unit_price_eur) * item.quantity).toFixed(2)} €</div>
        <div style="font-size:12px;color:var(--admin-muted)">${(Number(item.unit_price_kmf) * item.quantity).toLocaleString('fr-FR')} KMF</div>
      </div>
    </div>`).join('') + `
    <div style="display:flex;justify-content:space-between;padding:12px 0;font-weight:700">
      <span>Total</span>
      <span>${Number(o.total_eur).toFixed(2)} € / ${Number(o.total_kmf).toLocaleString('fr-FR')} KMF</span>
    </div>`;
}

async function init() {
  await adminAuth.requireAuth();
  if (orderId) await loadOrder();

  document.getElementById('save-status').addEventListener('click', async () => {
    const alertEl = document.getElementById('alert');
    try {
      await api.put(`/api/orders/${orderId}`, {
        status: document.getElementById('status-select').value,
        notes: document.getElementById('notes').value,
      });
      alertEl.className = 'alert alert--success'; alertEl.textContent = 'Commande mise à jour !'; alertEl.style.display = 'block';
      setTimeout(() => alertEl.style.display = 'none', 2000);
    } catch (e) {
      alertEl.className = 'alert alert--error'; alertEl.textContent = e.message; alertEl.style.display = 'block';
    }
  });
}

init();
