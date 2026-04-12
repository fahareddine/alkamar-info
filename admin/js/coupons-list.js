// admin/js/coupons-list.js

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

const TYPE_LABELS = {
  percentage: '% remise',
  fixed_eur:  '€ fixe',
  fixed_kmf:  'KMF fixe',
};

function formatValue(type, value) {
  if (type === 'percentage') return `${value} %`;
  if (type === 'fixed_eur')  return `${value} €`;
  if (type === 'fixed_kmf')  return `${value} KMF`;
  return String(value);
}

function formatUses(uses_count, max_uses) {
  const used = uses_count ?? 0;
  const max  = max_uses != null ? max_uses : '∞';
  return `${used} / ${max}`;
}

function formatExpiration(expires_at) {
  if (!expires_at) return 'Jamais';
  return new Date(expires_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function getStatusBadge(coupon) {
  if (!coupon.is_active) {
    return '<span class="badge badge--draft">Inactif</span>';
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return '<span class="badge badge--archived">Expiré</span>';
  }
  if (coupon.max_uses != null && (coupon.uses_count ?? 0) >= coupon.max_uses) {
    return '<span class="badge badge--archived">Épuisé</span>';
  }
  return '<span class="badge badge--active">Actif</span>';
}

async function loadCoupons() {
  const data = await api.get('/api/coupons');
  const tbody = document.getElementById('coupons-body');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--admin-muted)">Aucun code promo</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(c => `
    <tr>
      <td style="font-weight:600;letter-spacing:.05em">${esc(c.code)}</td>
      <td style="color:var(--admin-muted)">${esc(TYPE_LABELS[c.type] || c.type)}</td>
      <td>${esc(formatValue(c.type, c.value))}</td>
      <td style="color:var(--admin-muted)">${esc(formatUses(c.uses_count, c.max_uses))}</td>
      <td style="color:var(--admin-muted)">${c.min_order_eur != null ? esc(String(c.min_order_eur)) + ' €' : '—'}</td>
      <td style="font-size:13px;color:var(--admin-muted)">${esc(formatExpiration(c.expires_at))}</td>
      <td>${getStatusBadge(c)}</td>
    </tr>`
  ).join('');
}

async function handleCreate(e) {
  e.preventDefault();
  const alertEl = document.getElementById('form-alert');
  alertEl.textContent = '';
  alertEl.className = '';
  alertEl.style.display = 'none';

  const code      = document.getElementById('f-code').value.trim().toUpperCase();
  const type      = document.getElementById('f-type').value;
  const value     = parseFloat(document.getElementById('f-value').value);
  const minOrder  = document.getElementById('f-min-order').value.trim();
  const maxUses   = document.getElementById('f-max-uses').value.trim();
  const expires   = document.getElementById('f-expires').value;
  const is_active = document.getElementById('f-active').checked;

  if (!code || isNaN(value) || value <= 0) {
    alertEl.textContent = 'Veuillez renseigner un code et une valeur valide.';
    alertEl.className = 'alert alert--error';
    alertEl.style.display = 'block';
    return;
  }

  const body = {
    code,
    type,
    value,
    is_active,
    min_order_eur: minOrder !== '' ? parseFloat(minOrder) : null,
    max_uses:      maxUses  !== '' ? parseInt(maxUses, 10) : null,
    expires_at:    expires  !== '' ? new Date(expires).toISOString() : null,
  };

  try {
    await api.post('/api/coupons', body);
    document.getElementById('create-form').reset();
    document.getElementById('f-active').checked = true;
    document.getElementById('create-form-wrap').style.display = 'none';
    document.getElementById('btn-toggle-form').textContent = '＋ Nouveau code';
    await loadCoupons();
  } catch (err) {
    alertEl.textContent = err.message || 'Erreur lors de la création.';
    alertEl.className = 'alert alert--error';
    alertEl.style.display = 'block';
  }
}

async function init() {
  await adminAuth.requireAuth();

  document.getElementById('btn-toggle-form').addEventListener('click', () => {
    const wrap    = document.getElementById('create-form-wrap');
    const btn     = document.getElementById('btn-toggle-form');
    const visible = wrap.style.display !== 'none';
    wrap.style.display = visible ? 'none' : 'block';
    btn.textContent = visible ? '＋ Nouveau code' : '✕ Annuler';
  });

  document.getElementById('btn-cancel-form').addEventListener('click', () => {
    document.getElementById('create-form-wrap').style.display = 'none';
    document.getElementById('btn-toggle-form').textContent = '＋ Nouveau code';
    document.getElementById('create-form').reset();
    document.getElementById('f-active').checked = true;
    const alertEl = document.getElementById('form-alert');
    alertEl.textContent = '';
    alertEl.className = '';
    alertEl.style.display = 'none';
  });

  document.getElementById('create-form').addEventListener('submit', handleCreate);

  await loadCoupons();
}

init();
