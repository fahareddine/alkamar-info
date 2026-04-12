// admin/js/promotions-list.js

const TYPE_LABELS = {
  percentage: '% remise',
  fixed_eur: '€ fixe',
  fixed_kmf: 'KMF fixe',
};

function formatValue(type, value) {
  if (type === 'percentage') return `${value} %`;
  if (type === 'fixed_eur') return `${value} €`;
  if (type === 'fixed_kmf') return `${value} KMF`;
  return value;
}

function formatTarget(target_type) {
  if (target_type === 'all') return 'Tous';
  if (target_type === 'category') return 'Catégorie';
  if (target_type === 'product') return 'Produit';
  return target_type;
}

function getStatusBadge(promo) {
  if (!promo.is_active) {
    return '<span class="badge badge--draft">Inactive</span>';
  }
  const now = new Date();
  const start = new Date(promo.starts_at);
  const end = new Date(promo.ends_at);
  if (now < start) {
    return '<span class="badge badge--pending">Planifiée</span>';
  }
  if (now > end) {
    return '<span class="badge badge--archived">Expirée</span>';
  }
  return '<span class="badge badge--active">Active</span>';
}

async function loadPromotions() {
  const promos = await api.get('/api/promotions?all=true');
  const tbody = document.getElementById('promotions-body');
  if (!promos || promos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--admin-muted)">Aucune promotion</td></tr>';
    return;
  }
  tbody.innerHTML = promos.map(p => {
    const start = new Date(p.starts_at).toLocaleDateString('fr-FR');
    const end = new Date(p.ends_at).toLocaleDateString('fr-FR');
    return `
    <tr>
      <td style="font-weight:600">${p.name}</td>
      <td style="color:var(--admin-muted)">${TYPE_LABELS[p.type] || p.type}</td>
      <td>${formatValue(p.type, p.value)}</td>
      <td style="color:var(--admin-muted)">${formatTarget(p.target_type)}</td>
      <td style="font-size:13px;color:var(--admin-muted)">${start} → ${end}</td>
      <td>${getStatusBadge(p)}</td>
      <td>
        ${p.is_active
          ? `<button onclick="disablePromotion('${p.id}')" class="btn btn--danger btn--sm">Désactiver</button>`
          : '<span style="font-size:12px;color:var(--admin-muted)">—</span>'
        }
      </td>
    </tr>`;
  }).join('');
}

async function disablePromotion(id) {
  if (!confirm('Désactiver cette promotion ?')) return;
  try {
    await api.delete(`/api/promotions/${id}`);
    await loadPromotions();
  } catch (e) {
    alert(e.message);
  }
}

async function handleCreate(e) {
  e.preventDefault();
  const alertEl = document.getElementById('form-alert');
  alertEl.innerHTML = '';

  const name = document.getElementById('f-name').value.trim();
  const type = document.getElementById('f-type').value;
  const value = parseFloat(document.getElementById('f-value').value);
  const target_type = document.getElementById('f-target').value;
  const starts_at = document.getElementById('f-starts').value;
  const ends_at = document.getElementById('f-ends').value;

  if (!name || isNaN(value) || value < 0 || !starts_at || !ends_at) {
    alertEl.innerHTML = '<div class="alert alert--error">Veuillez remplir tous les champs correctement.</div>';
    return;
  }
  if (new Date(ends_at) <= new Date(starts_at)) {
    alertEl.innerHTML = '<div class="alert alert--error">La date de fin doit être postérieure à la date de début.</div>';
    return;
  }

  try {
    await api.post('/api/promotions', {
      name,
      type,
      value,
      target_type,
      starts_at: new Date(starts_at).toISOString(),
      ends_at: new Date(ends_at).toISOString(),
      is_active: true,
    });
    document.getElementById('create-form').reset();
    document.getElementById('create-form-wrap').style.display = 'none';
    document.getElementById('btn-toggle-form').textContent = '＋ Nouvelle promotion';
    await loadPromotions();
  } catch (e) {
    alertEl.innerHTML = `<div class="alert alert--error">${e.message || 'Erreur lors de la création.'}</div>`;
  }
}

async function init() {
  await adminAuth.requireAuth();

  document.getElementById('btn-toggle-form').addEventListener('click', () => {
    const wrap = document.getElementById('create-form-wrap');
    const btn = document.getElementById('btn-toggle-form');
    const visible = wrap.style.display !== 'none';
    wrap.style.display = visible ? 'none' : 'block';
    btn.textContent = visible ? '＋ Nouvelle promotion' : '✕ Annuler';
  });

  document.getElementById('btn-cancel-form').addEventListener('click', () => {
    document.getElementById('create-form-wrap').style.display = 'none';
    document.getElementById('btn-toggle-form').textContent = '＋ Nouvelle promotion';
    document.getElementById('create-form').reset();
    document.getElementById('form-alert').innerHTML = '';
  });

  document.getElementById('create-form').addEventListener('submit', handleCreate);

  await loadPromotions();
}

init();
