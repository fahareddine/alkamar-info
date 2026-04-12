// admin/js/products-list.js
async function loadCategories() {
  const cats = await api.get('/api/categories');
  const sel = document.getElementById('filter-cat');
  (cats || []).filter(c => !c.parent_id).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

async function loadProducts() {
  const status = document.getElementById('filter-status').value;
  const cat = document.getElementById('filter-cat').value;
  const search = document.getElementById('search').value.trim();

  let url = `/api/products?limit=100&status=${status}`;
  if (cat) url += `&category=${cat}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  const products = await api.get(url);
  const tbody = document.getElementById('products-body');

  if (!products || products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--admin-muted)">Aucun produit trouvé</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td><img src="${p.image || ''}" alt="" class="prod-thumb" onerror="this.style.display='none'"></td>
      <td>
        <a href="/admin/products/edit.html?id=${p.id}" style="font-weight:600;color:var(--admin-text)">${p.name}</a>
        ${p.brand ? `<br><span style="font-size:11px;color:var(--admin-muted)">${p.brand}</span>` : ''}
      </td>
      <td style="font-size:13px;color:var(--admin-muted)">${p.categories?.name || '—'}</td>
      <td>${Number(p.price_eur).toFixed(2)} €</td>
      <td style="color:${p.stock === 0 ? 'var(--admin-danger)' : p.stock < 3 ? 'var(--admin-warning)' : 'inherit'}">${p.stock}</td>
      <td><span class="badge badge--${p.status}">${p.status === 'active' ? 'Actif' : p.status === 'draft' ? 'Brouillon' : 'Archivé'}</span></td>
      <td style="display:flex;gap:6px">
        <a href="/admin/products/edit.html?id=${p.id}" class="btn btn--ghost btn--sm">Éditer</a>
        <button onclick="archiveProduct('${p.id}')" class="btn btn--danger btn--sm">×</button>
      </td>
    </tr>`).join('');
}

async function archiveProduct(id) {
  if (!confirm('Archiver ce produit ?')) return;
  try { await api.delete(`/api/products/${id}`); loadProducts(); } catch (e) { alert(e.message); }
}

async function init() {
  await adminAuth.requireAuth();
  await loadCategories();
  await loadProducts();
  let t;
  document.getElementById('search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadProducts, 300); });
  document.getElementById('filter-status').addEventListener('change', loadProducts);
  document.getElementById('filter-cat').addEventListener('change', loadProducts);
}

init();
