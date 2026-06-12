// admin/js/journal.js — Journal d'activité (admin_logs)
'use strict';

const ACTION_LABELS = {
  'product.updated': '✏️ Produit modifié',
  'product.deleted': '🗑️ Produit supprimé',
  'product.created': '➕ Produit créé',
  'coupon.created': '🎫 Code promo créé',
  'order.updated': '🛒 Commande modifiée',
};

async function loadJournal() {
  const body = document.getElementById('jr-body');
  try {
    const logs = await api.get('/api/logs');
    if (!logs) return;
    body.replaceChildren();
    if (!logs.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.style.cssText = 'text-align:center;color:var(--admin-muted);padding:24px';
      td.textContent = 'Aucune activité enregistrée pour le moment.';
      tr.appendChild(td); body.appendChild(tr);
      return;
    }
    logs.forEach(l => {
      const tr = document.createElement('tr');

      const tdDate = document.createElement('td');
      tdDate.style.whiteSpace = 'nowrap';
      tdDate.textContent = new Date(l.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

      const tdUser = document.createElement('td');
      tdUser.textContent = l.user_profiles?.full_name || '—';

      const tdAction = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'badge badge--confirmed';
      badge.textContent = ACTION_LABELS[l.action] || l.action;
      tdAction.appendChild(badge);

      const tdDetail = document.createElement('td');
      tdDetail.style.cssText = 'font-size:12px;color:var(--admin-muted);max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      const detail = l.new_value ? JSON.stringify(l.new_value) : (l.entity_id || '');
      tdDetail.textContent = detail.slice(0, 140);
      tdDetail.title = detail;

      tr.append(tdDate, tdUser, tdAction, tdDetail);
      body.appendChild(tr);
    });
  } catch (e) {
    body.replaceChildren();
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.style.cssText = 'text-align:center;color:var(--admin-danger);padding:24px';
    td.textContent = 'Erreur de chargement : ' + e.message;
    tr.appendChild(td); body.appendChild(tr);
  }
}

document.addEventListener('DOMContentLoaded', loadJournal);
