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
    const response = await fetch('/api/stock/movements?limit=100');
    if (!response.ok) throw new Error('Erreur lors du chargement des mouvements');

    const movements = await response.json();
    const tbody = document.getElementById('movements-tbody');
    tbody.innerHTML = '';

    movements.forEach(m => {
      const row = document.createElement('tr');

      const quantityColor = (m.quantity || 0) > 0 ? 'green' : (m.quantity || 0) < 0 ? 'red' : 'black';
      const dateObj = new Date(m.created_at);
      const dateStr = dateObj.toLocaleDateString('fr-FR');

      row.innerHTML = `
        <td>${esc(m.products?.name || m.products?.id || '—')}</td>
        <td>${getTypeLabel(m.type)}</td>
        <td style="color: ${quantityColor};">${m.quantity || '0'}</td>
        <td>${esc(m.reference_type || '—')}</td>
        <td>${esc(m.note || '—')}</td>
        <td>${esc(m.user_profiles?.full_name || '—')}</td>
        <td>${dateStr}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Erreur:', error);
    const tbody = document.getElementById('movements-tbody');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Erreur : ${esc(error.message)}</td></tr>`;
  }
}

async function handleCreate(e) {
  e.preventDefault();

  const productId = document.getElementById('product-id').value.trim();
  const type = document.getElementById('type').value;
  const quantity = parseInt(document.getElementById('quantity').value, 10);
  const note = document.getElementById('note').value.trim();

  if (!productId || !type || !quantity || quantity === 0) {
    alert('Veuillez remplir tous les champs requis');
    return;
  }

  try {
    const response = await fetch('/api/stock/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        type,
        quantity,
        note: note || null
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erreur lors de l\'ajustement');
    }

    alert('Ajustement enregistré');
    document.getElementById('create-form').reset();
    document.getElementById('create-form-wrap').style.display = 'none';
    await loadMovements();
  } catch (error) {
    console.error('Erreur:', error);
    alert('Erreur : ' + error.message);
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
