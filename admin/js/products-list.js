// admin/js/products-list.js

const PAGE_SIZE = 20;
let state = { offset: 0, sort: 'name', dir: 'asc', selected: new Set() };

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function statusLabel(s) {
  return { active: 'Actif', draft: 'Brouillon', archived: 'Archivé' }[s] || s;
}

function stockColor(n) {
  return n === 0 ? 'var(--admin-danger)' : n < 3 ? 'var(--admin-warning)' : '';
}

async function loadStats() {
  try {
    const products = await api.get('/api/products?status=all&limit=200');
    const all = products || [];
    document.getElementById('stat-total').textContent = all.length;
    document.getElementById('stat-active').textContent = all.filter(p => p.status === 'active').length;
    document.getElementById('stat-draft').textContent = all.filter(p => p.status === 'draft').length;
    document.getElementById('stat-archived').textContent = all.filter(p => p.status === 'archived').length;
  } catch (e) {
    console.error('loadStats error', e);
  }
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const count = state.selected.size;
  bar.classList.toggle('bulk-bar--hidden', count === 0);
  document.getElementById('bulk-count').textContent = `${count} sélectionné${count > 1 ? 's' : ''}`;
}

async function bulkAction(action) {
  const ids = [...state.selected];
  if (!ids.length) return;

  if (action === 'delete') {
    if (!confirm(`Supprimer (archiver) ${ids.length} produit${ids.length > 1 ? 's' : ''} ?`)) return;
    try {
      await Promise.all(ids.map(id => api.delete('/api/products/' + id)));
    } catch (e) { alert(e.message); return; }
  } else if (action === 'publish') {
    try {
      await Promise.all(ids.map(id => api.put('/api/products/' + id, { status: 'active' })));
    } catch (e) { alert(e.message); return; }
  } else if (action === 'archive') {
    try {
      await Promise.all(ids.map(id => api.delete('/api/products/' + id)));
    } catch (e) { alert(e.message); return; }
  }

  state.selected.clear();
  updateBulkBar();
  await loadProducts();
}

async function duplicateProduct(id) {
  try {
    const p = await api.get('/api/products/' + id);
    const copy = {
      name: 'Copie de ' + p.name,
      status: 'draft',
      price_eur: p.price_eur,
      price_kmf: p.price_kmf,
      price_old: p.price_old,
      stock: 0,
      brand: p.brand,
      subtitle: p.subtitle,
      description: p.description,
      category_id: p.category_id,
      badge: p.badge,
      features: p.features,
      specs: p.specs,
      image: p.image,
      gallery: p.gallery,
    };
    const baseSlug = p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    copy.slug = baseSlug + '-copy-' + Date.now();
    await api.post('/api/products', copy);
    await loadProducts();
  } catch (e) {
    alert(e.message);
  }
}

async function archiveProduct(id) {
  if (!confirm('Archiver ce produit ?')) return;
  try {
    await api.delete('/api/products/' + id);
    state.selected.delete(id);
    await loadProducts();
  } catch (e) {
    alert(e.message);
  }
}

async function loadProducts() {
  const status = document.getElementById('filter-status').value || 'all';
  const cat = document.getElementById('filter-cat').value;
  const search = document.getElementById('search').value.trim();

  let url = `/api/products?limit=${PAGE_SIZE}&offset=${state.offset}&status=${status}`;
  if (cat) url += `&category=${cat}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  let products;
  try {
    products = await api.get(url);
  } catch (e) {
    const tbody = document.getElementById('products-body');
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--admin-danger)">${esc(e.message)}</td></tr>`;
    return;
  }

  // Tri client
  const sorted = [...(products || [])].sort((a, b) => {
    let va = a[state.sort] ?? '', vb = b[state.sort] ?? '';
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    return state.dir === 'asc'
      ? (va < vb ? -1 : va > vb ? 1 : 0)
      : (va > vb ? -1 : va < vb ? 1 : 0);
  });

  const tbody = document.getElementById('products-body');

  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--admin-muted)">Aucun produit trouvé</td></tr>';
    updatePagination(0);
    return;
  }

  tbody.innerHTML = sorted.map(p => {
    const color = stockColor(p.stock);
    const stockStyle = color ? `font-weight:600;color:${color}` : 'font-weight:600';
    const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '—';
    return `
    <tr data-id="${esc(p.id)}" class="${state.selected.has(p.id) ? 'row-selected' : ''}">
      <td class="check-col">
        <input type="checkbox" class="row-check" value="${esc(p.id)}" ${state.selected.has(p.id) ? 'checked' : ''}>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <img src="${esc(p.image || '')}" class="prod-thumb" alt="" onerror="this.style.opacity=0">
          <div>
            <a href="/admin/products/edit.html?id=${esc(p.id)}" style="font-weight:600;color:var(--admin-text)">${esc(p.name)}</a>
            ${p.brand ? `<br><span style="font-size:11px;color:var(--admin-muted)">${esc(p.brand)}</span>` : ''}
          </div>
        </div>
      </td>
      <td style="font-size:12px;color:var(--admin-muted)">${esc(p.sku || '—')}</td>
      <td style="font-size:13px;color:var(--admin-muted)">${esc(p.categories?.name || '—')}</td>
      <td>${Number(p.price_eur).toFixed(2)} €</td>
      <td style="${stockStyle}">${p.stock}</td>
      <td><span class="badge badge--${esc(p.status)}">${statusLabel(p.status)}</span></td>
      <td style="font-size:12px;color:var(--admin-muted)">${dateStr}</td>
      <td>
        <div style="display:flex;gap:4px">
          <a href="/admin/products/edit.html?id=${esc(p.id)}" class="btn btn--ghost btn--sm">Éditer</a>
          <button onclick="duplicateProduct('${esc(p.id)}')" class="btn btn--ghost btn--sm" title="Dupliquer">⧉</button>
          <button onclick="archiveProduct('${esc(p.id)}')" class="btn btn--danger btn--sm" title="Archiver">×</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Listeners checkboxes
  tbody.querySelectorAll('.row-check').forEach(cb => {
    cb.addEventListener('change', e => {
      if (e.target.checked) state.selected.add(e.target.value);
      else state.selected.delete(e.target.value);
      updateBulkBar();
      e.target.closest('tr').classList.toggle('row-selected', e.target.checked);
    });
  });

  updatePagination(sorted.length);
}

function updatePagination(count) {
  const page = Math.floor(state.offset / PAGE_SIZE) + 1;
  document.getElementById('page-info').textContent = `Page ${page} · ${count} résultats`;
  document.getElementById('btn-prev').disabled = state.offset === 0;
  document.getElementById('btn-next').disabled = count < PAGE_SIZE;
}

async function loadCategories() {
  try {
    const cats = await api.get('/api/categories');
    const sel = document.getElementById('filter-cat');
    (cats || []).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = (c.parent_id ? '  ' : '') + c.name;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error('loadCategories error', e);
  }
}

async function init() {
  await adminAuth.requireAuth();
  await Promise.all([loadCategories(), loadProducts(), loadStats()]);

  // Search debounce
  let t;
  document.getElementById('search').addEventListener('input', () => {
    clearTimeout(t);
    state.offset = 0;
    t = setTimeout(loadProducts, 300);
  });

  document.getElementById('filter-status').addEventListener('change', () => {
    state.offset = 0;
    loadProducts();
  });

  document.getElementById('filter-cat').addEventListener('change', () => {
    state.offset = 0;
    loadProducts();
  });

  // Sort headers
  document.querySelectorAll('.th-sort').forEach(th => {
    th.innerHTML += ' <span class="sort-icon"></span>';
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.sort === col) {
        state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort = col;
        state.dir = 'asc';
      }
      document.querySelectorAll('.th-sort').forEach(t => t.classList.remove('asc', 'desc'));
      th.classList.add(state.dir);
      state.offset = 0;
      loadProducts();
    });
  });

  // Select all
  document.getElementById('select-all').addEventListener('change', e => {
    document.querySelectorAll('.row-check').forEach(cb => {
      cb.checked = e.target.checked;
      if (e.target.checked) state.selected.add(cb.value);
      else state.selected.delete(cb.value);
      cb.closest('tr').classList.toggle('row-selected', e.target.checked);
    });
    updateBulkBar();
  });

  // Bulk actions
  document.getElementById('btn-bulk-publish').addEventListener('click', () => bulkAction('publish'));
  document.getElementById('btn-bulk-archive').addEventListener('click', () => bulkAction('archive'));
  document.getElementById('btn-bulk-delete').addEventListener('click', () => bulkAction('delete'));

  // Pagination
  document.getElementById('btn-prev').addEventListener('click', () => {
    state.offset = Math.max(0, state.offset - PAGE_SIZE);
    loadProducts();
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    state.offset += PAGE_SIZE;
    loadProducts();
  });
}

init();
