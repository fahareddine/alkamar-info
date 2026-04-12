// admin/js/categories.js
async function init() {
  await adminAuth.requireAuth();
  const cats = await api.get('/api/categories');
  const parentMap = Object.fromEntries((cats || []).map(c => [c.id, c.name]));
  const tbody = document.getElementById('cats-body');
  tbody.innerHTML = (cats || []).map(c => `
    <tr>
      <td>${c.icon || ''}</td>
      <td style="font-weight:${c.parent_id ? '400' : '700'}">${c.parent_id ? '↳ ' : ''}${c.name}</td>
      <td style="font-family:monospace;font-size:12px;color:var(--admin-muted)">${c.slug}</td>
      <td style="color:var(--admin-muted)">${c.parent_id ? parentMap[c.parent_id] || '—' : '—'}</td>
      <td style="color:var(--admin-muted)">${c.sort_order}</td>
    </tr>`).join('');
}

init();
