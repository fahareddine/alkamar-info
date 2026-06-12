// admin/js/dashboard.js
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
            <td><a href="/admin/orders/detail.html?id=${o.id}">${esc(o.customers?.name || '—')}</a></td>
            <td>${Number(o.total_eur).toFixed(2)} €</td>
            <td><span class="badge badge--${o.status}">${STATUS_LABELS[o.status] || o.status}</span></td>
            <td style="color:var(--admin-muted);font-size:12px">${new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
          </tr>`).join('');

    const stockBody = document.getElementById('stock-body');
    stockBody.innerHTML = stats.stock_alerts.length === 0
      ? '<tr><td colspan="2" style="text-align:center;color:var(--admin-muted);padding:16px">Aucune alerte</td></tr>'
      : stats.stock_alerts.map(p => `
          <tr>
            <td><a href="/admin/products/edit.html?id=${p.id}">${esc(p.name)}</a></td>
            <td style="color:${p.stock === 0 ? 'var(--admin-danger)' : 'var(--admin-warning)'};font-weight:700">${p.stock}</td>
          </tr>`).join('');
  } catch (e) {
    console.error('Dashboard error:', e);
  }

  loadAnalytics();
}

/* ── Analytics ventes 30 jours (DOM pur, valeurs textContent) ── */
function anaRow(cells) {
  const tr = document.createElement('tr');
  cells.forEach(c => tr.appendChild(c));
  return tr;
}
function anaTd(text, style, link) {
  const td = document.createElement('td');
  if (link) {
    const a = document.createElement('a');
    a.href = link;
    a.textContent = text;
    td.appendChild(a);
  } else {
    td.textContent = text;
  }
  if (style) td.style.cssText = style;
  return td;
}
function anaEmpty(tbody, colspan, msg) {
  tbody.replaceChildren();
  const td = anaTd(msg, 'text-align:center;color:var(--admin-muted);padding:16px');
  td.colSpan = colspan;
  tbody.appendChild(anaRow([td]));
}

async function loadAnalytics() {
  try {
    const a = await api.get('/api/orders?_route=analytics');
    if (!a) return;

    document.getElementById('ana-ca').textContent =
      a.total_revenue_eur.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    document.getElementById('ana-cart').textContent =
      a.avg_cart_eur.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    document.getElementById('ana-paid').textContent = a.paid_rate + ' %';
    document.getElementById('ana-paid-sub').textContent = `${a.paid_count}/${a.orders_count} commandes payées`;
    document.getElementById('ana-neversold').textContent = a.never_sold_count;
    document.getElementById('ana-kpis').style.display = '';

    // Mini graphique CA par jour (barres CSS pures)
    const days = Object.entries(a.revenue_by_day);
    const max = Math.max(...days.map(([, v]) => v), 1);
    const chart = document.getElementById('ana-chart');
    chart.replaceChildren();
    days.forEach(([d, v]) => {
      const bar = document.createElement('div');
      const pct = Math.max(2, Math.round((v / max) * 100));
      bar.style.cssText = `flex:1;height:${pct}%;background:${v > 0 ? 'var(--admin-accent)' : 'var(--admin-border)'};border-radius:3px 3px 0 0;min-width:4px`;
      bar.title = `${new Date(d).toLocaleDateString('fr-FR')} : ${v.toFixed(2)} €`;
      chart.appendChild(bar);
    });
    document.getElementById('ana-chart-start').textContent = new Date(days[0][0]).toLocaleDateString('fr-FR');
    document.getElementById('ana-chart-end').textContent = new Date(days[days.length - 1][0]).toLocaleDateString('fr-FR');
    document.getElementById('ana-chart-card').style.display = '';

    // Top produits
    const topBody = document.getElementById('ana-top-body');
    if (!a.top_products.length) {
      anaEmpty(topBody, 3, 'Aucune vente avec détail produit sur 30 jours');
    } else {
      topBody.replaceChildren();
      a.top_products.forEach(p => {
        topBody.appendChild(anaRow([
          anaTd(p.name),
          anaTd(String(p.qty), 'font-weight:700'),
          anaTd(p.revenue.toFixed(2).replace('.', ',') + ' €'),
        ]));
      });
    }

    // Jamais vendus
    const neverBody = document.getElementById('ana-never-body');
    if (!a.never_sold_sample.length) {
      anaEmpty(neverBody, 2, 'Tout s\'est vendu 🎉');
    } else {
      neverBody.replaceChildren();
      a.never_sold_sample.forEach(p => {
        neverBody.appendChild(anaRow([
          anaTd(p.name, '', '/admin/products/edit.html?id=' + p.id),
          anaTd(Number(p.price_eur).toFixed(2).replace('.', ',') + ' €'),
        ]));
      });
    }
    document.getElementById('ana-tables').style.display = '';
  } catch (e) {
    console.error('Analytics error:', e);
  }
}

loadDashboard();
