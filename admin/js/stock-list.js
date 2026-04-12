function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function getTypeLabel(type) {
  const types = {
    'in': '🟢 Entrée',
    'out': '🔴 Sortie',
    'adjustment': '🔵 Ajustement',
    'return': '🟡 Retour'
  };
  return types[type] || '—';
}

async function loadMovements() {
  try {
    const movements = await api.get('/api/stock/movements?limit=100');
    const tbody = document.getElementById('movements-tbody');

    if (!movements || movements.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--admin-muted)">Aucun mouvement</td></tr>';
      return;
    }

    tbody.innerHTML = movements.map(m => {
      const quantityColor = (m.quantity || 0) > 0 ? 'var(--admin-success, #22c55e)' : (m.quantity || 0) < 0 ? 'var(--admin-danger, #ef4444)' : '';
      const dateStr = new Date(m.created_at).toLocaleDateString('fr-FR');
      return `<tr>
        <td>${esc(m.products?.name || m.products?.id || '—')}</td>
        <td>${getTypeLabel(m.type)}</td>
        <td style="font-weight:600;color:${quantityColor}">${m.quantity > 0 ? '+' : ''}${m.quantity || '0'}</td>
        <td>${esc(m.reference_type || '—')}</td>
        <td>${esc(m.note || '—')}</td>
        <td>${esc(m.user_profiles?.full_name || '—')}</td>
        <td style="color:var(--admin-muted);font-size:13px">${dateStr}</td>
      </tr>`;
    }).join('');
  } catch (error) {
    console.error('Erreur:', error);
    const tbody = document.getElementById('movements-tbody');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--admin-danger,red)">Erreur : ${esc(error.message)}</td></tr>`;
  }
}

async function handleCreate(e) {
  e.preventDefault();

  const productId = document.getElementById('product-id').value.trim();
  const type = document.getElementById('type').value;
  const quantity = parseInt(document.getElementById('quantity').value, 10);
  const note = document.getElementById('note').value.trim();

  if (!productId || !type || isNaN(quantity) || quantity === 0) {
    alert('Veuillez remplir tous les champs requis');
    return;
  }

  try {
    await api.post('/api/stock/movements', {
      product_id: productId,
      type,
      quantity,
      note: note || null
    });

    alert('Ajustement enregistré');
    document.getElementById('create-form').reset();
    document.getElementById('create-form-wrap').style.display = 'none';
    await loadMovements();
  } catch (error) {
    console.error('Erreur:', error);
    alert('Erreur : ' + String(error.message || 'Erreur inconnue'));
  }
}

async function init() {
  await adminAuth.requireAuth();
  await loadMovements();

  const createBtn = document.getElementById('create-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const formWrap = document.getElementById('create-form-wrap');
  const form = document.getElementById('create-form');

  createBtn.addEventListener('click', () => {
    formWrap.style.display = formWrap.style.display === 'none' ? 'block' : 'none';
  });

  cancelBtn.addEventListener('click', () => {
    formWrap.style.display = 'none';
    form.reset();
  });

  form.addEventListener('submit', handleCreate);
}

init();
