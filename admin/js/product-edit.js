// admin/js/product-edit.js
const productId = new URLSearchParams(window.location.search).get('id');

function addSpecRow(key = '', value = '') {
  const container = document.getElementById('specs-container');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  row.innerHTML = `
    <input type="text" placeholder="Clé (ex: RAM)" value="${key}" class="form-control spec-key" style="flex:1">
    <input type="text" placeholder="Valeur (ex: 16 Go)" value="${value}" class="form-control spec-val" style="flex:2">
    <button type="button" class="btn btn--danger btn--sm" onclick="this.parentElement.remove()">×</button>`;
  container.appendChild(row);
}

function getSpecs() {
  const specs = {};
  document.querySelectorAll('#specs-container > div').forEach(row => {
    const k = row.querySelector('.spec-key').value.trim();
    const v = row.querySelector('.spec-val').value.trim();
    if (k) specs[k] = v;
  });
  return specs;
}

async function loadCategories() {
  const cats = await api.get('/api/categories');
  const sel = document.getElementById('cat-select');
  (cats || []).filter(c => c.parent_id).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

async function loadProduct(id) {
  const p = await api.get(`/api/products/${id}`);
  if (!p) return;
  document.getElementById('page-title').textContent = `Éditer : ${p.name}`;
  const form = document.getElementById('product-form');
  ['name','brand','subtitle','description','price_eur','price_kmf','price_old','stock','status','badge','image'].forEach(f => {
    if (form[f] && p[f] !== null && p[f] !== undefined) form[f].value = p[f];
  });
  if (form.category_id && p.category_id) form.category_id.value = p.category_id;
  Object.entries(p.specs || {}).forEach(([k, v]) => addSpecRow(k, v));
}

async function init() {
  await adminAuth.requireAuth();
  await loadCategories();
  if (productId) await loadProduct(productId);

  document.querySelector('[name=price_eur]').addEventListener('input', function() {
    const kmfField = document.querySelector('[name=price_kmf]');
    if (this.value) kmfField.value = Math.round(Number(this.value) * 491);
  });

  document.getElementById('add-spec').addEventListener('click', () => addSpecRow());

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const alertEl = document.getElementById('alert');
    btn.disabled = true; btn.textContent = 'Enregistrement...';
    alertEl.style.display = 'none';

    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.price_eur = Number(body.price_eur);
    body.price_kmf = Number(body.price_kmf);
    body.price_old = body.price_old ? Number(body.price_old) : null;
    body.stock = Number(body.stock);
    body.specs = getSpecs();
    if (!body.slug) body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    Object.keys(body).forEach(k => { if (body[k] === '' || body[k] === null) delete body[k]; });

    try {
      if (productId) {
        await api.put(`/api/products/${productId}`, body);
      } else {
        await api.post('/api/products', body);
      }
      alertEl.className = 'alert alert--success'; alertEl.textContent = 'Produit enregistré !'; alertEl.style.display = 'block';
      setTimeout(() => window.location.href = '/admin/products/', 800);
    } catch (err) {
      alertEl.className = 'alert alert--error'; alertEl.textContent = err.message; alertEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Enregistrer';
    }
  });
}

init();
