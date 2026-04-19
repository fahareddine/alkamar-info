// admin/js/categories.js — CRUD catégories

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

let allCats = [];
let editingId = null;
let slugManual = false;

function showAlert(msg, type = 'success') {
  const el = document.getElementById('alert');
  el.className = `alert alert--${type}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}

function renderTable() {
  const parentMap = Object.fromEntries(allCats.map(c => [c.id, c.name]));
  const tbody = document.getElementById('cats-body');
  document.getElementById('cats-count').textContent =
    `${allCats.length} catégorie${allCats.length > 1 ? 's' : ''}`;

  if (!allCats.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--admin-muted)">Aucune catégorie</td></tr>';
    return;
  }

  tbody.innerHTML = allCats.map(c => `
    <tr>
      <td style="font-size:20px;text-align:center">${c.icon || ''}</td>
      <td style="font-weight:${c.parent_id ? '400' : '700'}">
        ${c.parent_id ? '<span style="color:var(--admin-muted)">↳ </span>' : ''}${c.name}
      </td>
      <td style="font-family:monospace;font-size:12px;color:var(--admin-muted)">${c.slug}</td>
      <td style="color:var(--admin-muted)">${c.parent_id ? (parentMap[c.parent_id] || '—') : '—'}</td>
      <td style="text-align:center;color:var(--admin-muted)">${c.sort_order ?? 0}</td>
      <td>
        <div class="cat-row-actions">
          <button class="btn btn--ghost btn--sm" onclick="startEdit('${c.id}')" title="Modifier">✏️</button>
          <button class="btn btn--danger btn--sm" onclick="deleteCategory('${c.id}','${c.name.replace(/'/g, "\\'")}')" title="Supprimer">🗑</button>
        </div>
      </td>
    </tr>`).join('');
}

function populateParentSelect(excludeId = null) {
  const sel = document.getElementById('cat-parent');
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Aucune (catégorie principale) —</option>';
  allCats.filter(c => !c.parent_id && c.id !== excludeId).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = (c.icon ? c.icon + ' ' : '') + c.name;
    sel.appendChild(opt);
  });
  if (prev && prev !== excludeId) sel.value = prev;
}

function resetForm() {
  editingId = null;
  slugManual = false;
  document.getElementById('cat-name').value = '';
  document.getElementById('cat-slug').value = '';
  document.getElementById('cat-icon').value = '';
  document.getElementById('cat-parent').value = '';
  document.getElementById('cat-order').value = '0';
  document.getElementById('form-title').textContent = 'Ajouter une catégorie';
  document.getElementById('btn-save-cat').textContent = 'Ajouter';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  populateParentSelect();
}

window.startEdit = function (id) {
  const cat = allCats.find(c => c.id === id);
  if (!cat) return;
  editingId = id;
  slugManual = true;
  document.getElementById('cat-name').value = cat.name || '';
  document.getElementById('cat-slug').value = cat.slug || '';
  document.getElementById('cat-icon').value = cat.icon || '';
  document.getElementById('cat-order').value = cat.sort_order ?? 0;
  document.getElementById('form-title').textContent = 'Modifier la catégorie';
  document.getElementById('btn-save-cat').textContent = 'Mettre à jour';
  document.getElementById('btn-cancel-edit').style.display = '';
  populateParentSelect(id);
  document.getElementById('cat-parent').value = cat.parent_id || '';
  document.getElementById('cat-name').focus();
  document.querySelector('.cats-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.deleteCategory = async function (id, name) {
  if (!confirm(`Supprimer la catégorie "${name}" ?\n\nLes produits associés ne seront pas supprimés mais perdront leur catégorie.`)) return;
  try {
    await api.delete(`/api/categories?id=${id}`);
    allCats = allCats.filter(c => c.id !== id);
    renderTable();
    populateParentSelect();
    if (editingId === id) resetForm();
    showAlert(`Catégorie "${name}" supprimée.`);
  } catch (err) {
    showAlert(err.message || 'Erreur lors de la suppression', 'error');
  }
};

async function saveCategory() {
  const name = document.getElementById('cat-name').value.trim();
  if (!name) { document.getElementById('cat-name').focus(); return; }

  const slug = document.getElementById('cat-slug').value.trim() || slugify(name);
  const icon = document.getElementById('cat-icon').value.trim() || null;
  const parent_id = document.getElementById('cat-parent').value || null;
  const sort_order = Number(document.getElementById('cat-order').value) || 0;

  const btn = document.getElementById('btn-save-cat');
  btn.disabled = true;
  btn.textContent = 'Enregistrement...';

  try {
    if (editingId) {
      const updated = await api.put(`/api/categories?id=${editingId}`, { name, slug, icon, parent_id, sort_order });
      const idx = allCats.findIndex(c => c.id === editingId);
      if (idx >= 0) allCats[idx] = updated || { ...allCats[idx], name, slug, icon, parent_id, sort_order };
      showAlert(`Catégorie "${name}" mise à jour.`);
    } else {
      const created = await api.post('/api/categories', { name, slug, icon, parent_id, sort_order });
      if (created?.id) allCats.push(created);
      showAlert(`Catégorie "${name}" créée.`);
    }
    renderTable();
    resetForm();
  } catch (err) {
    showAlert(err.message || 'Erreur lors de l\'enregistrement', 'error');
    btn.disabled = false;
    btn.textContent = editingId ? 'Mettre à jour' : 'Ajouter';
  }
}

async function init() {
  await adminAuth.requireAuth();
  allCats = await api.get('/api/categories') || [];
  renderTable();
  populateParentSelect();

  document.getElementById('cat-name').addEventListener('input', function () {
    if (!slugManual) document.getElementById('cat-slug').value = slugify(this.value);
  });
  document.getElementById('cat-slug').addEventListener('input', () => { slugManual = true; });
  document.getElementById('btn-save-cat').addEventListener('click', saveCategory);
  document.getElementById('btn-cancel-edit').addEventListener('click', resetForm);

  document.getElementById('cat-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveCategory(); }
  });
}

init();
