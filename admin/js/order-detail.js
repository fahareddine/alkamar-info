// admin/js/order-detail.js
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const orderId = new URLSearchParams(window.location.search).get('id');

async function loadOrder() {
  const o = await api.get(`/api/orders/${orderId}`);
  if (!o) return;
  document.getElementById('page-title').textContent = `Commande #${o.id.slice(0,8)}`;
  document.getElementById('status-select').value = o.status;
  document.getElementById('notes').value = o.notes || '';
  if (o.payment_status) document.getElementById('payment-select').value = o.payment_status;

  // Bouton WhatsApp avec message pré-rempli (canal n°1 aux Comores)
  const waNum = (o.customer_whatsapp || o.customers?.phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (waNum) {
    const orderNum = o.id.slice(0, 8).toUpperCase();
    const msg = encodeURIComponent(
      `Bonjour ${o.customer_name || o.customers?.name || ''}, c'est la Boutique Info Experts. ` +
      `Au sujet de votre commande #${orderNum} (${Number(o.total_eur).toFixed(2)} €) : `
    );
    const wa = document.getElementById('wa-link');
    wa.href = `https://wa.me/${waNum}?text=${msg}`;
    wa.style.display = 'flex';
  }

  document.getElementById('customer-info').innerHTML = o.customers ? `
    <p style="font-weight:600">${esc(o.customers.name)}</p>
    <p style="color:var(--admin-muted);font-size:13px">${esc(o.customers.email || '')}</p>
    <p style="color:var(--admin-muted);font-size:13px">${esc(o.customers.phone || '')}</p>
    <p style="color:var(--admin-muted);font-size:13px">${esc(o.customers.city || '')}</p>
  ` : '—';

  document.getElementById('order-items').innerHTML = (o.order_items || []).map(item => `
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--admin-border)">
      <div>
        <div style="font-weight:600">${esc(item.product_snapshot?.name || item.products?.name || '—')}</div>
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
      const updated = await api.put(`/api/orders/${orderId}`, {
        status: document.getElementById('status-select').value,
        payment_status: document.getElementById('payment-select').value,
        notes: document.getElementById('notes').value,
      });
      alertEl.className = 'alert alert--success';
      alertEl.textContent = 'Commande mise à jour !' +
        (updated?._email?.success ? ' 📧 Email de suivi envoyé au client.' : '');
      alertEl.style.display = 'block';
      setTimeout(() => alertEl.style.display = 'none', 2000);
    } catch (e) {
      alertEl.className = 'alert alert--error'; alertEl.textContent = e.message; alertEl.style.display = 'block';
    }
  });
}

init();
