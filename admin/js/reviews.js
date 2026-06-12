// admin/js/reviews.js — Modération des avis + alertes retour en stock
'use strict';

let _filter = 'pending';

function rvStatus(msg, isError) {
  const el = document.getElementById('rv-status');
  el.textContent = msg;
  el.className = 'alert ' + (isError ? 'alert--error' : 'alert--success');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3500);
}

function setFilter(f, btn) {
  _filter = f;
  document.querySelectorAll('.rv-tabs .btn').forEach(b => { b.className = 'btn btn--sm btn--ghost'; });
  btn.className = 'btn btn--sm btn--primary';
  loadReviews();
}
window.setFilter = setFilter;

function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

const STATUS_BADGE = { pending: 'badge--pending', approved: 'badge--active', rejected: 'badge--archived' };
const STATUS_LABEL = { pending: 'En attente', approved: 'Approuvé', rejected: 'Rejeté' };

async function loadReviews() {
  const body = document.getElementById('rv-body');
  try {
    const url = '/api/products?_route=reviews&admin=1' + (_filter ? `&status=${_filter}` : '');
    const list = await api.get(url);
    if (!list) return;
    body.replaceChildren();
    if (!list.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.style.cssText = 'text-align:center;color:var(--admin-muted);padding:24px';
      td.textContent = _filter === 'pending' ? 'Aucun avis en attente de modération. 👍' : 'Aucun avis.';
      tr.appendChild(td); body.appendChild(tr);
      return;
    }
    list.forEach(r => {
      const tr = document.createElement('tr');

      const tdProd = document.createElement('td');
      const link = document.createElement('a');
      link.href = '/produit.html?id=' + encodeURIComponent(r.products?.slug || r.products?.legacy_id || r.product_id);
      link.target = '_blank';
      link.textContent = r.products?.name || '—';
      tdProd.appendChild(link);

      const tdAuthor = document.createElement('td');
      const author = document.createElement('div');
      author.textContent = r.author_name;
      author.style.fontWeight = '600';
      tdAuthor.appendChild(author);
      if (r.email) {
        const mail = document.createElement('div');
        mail.textContent = r.email;
        mail.style.cssText = 'font-size:12px;color:var(--admin-muted)';
        tdAuthor.appendChild(mail);
      }

      const tdNote = document.createElement('td');
      tdNote.className = 'rv-stars';
      tdNote.textContent = stars(r.rating);

      const tdComment = document.createElement('td');
      tdComment.className = 'rv-comment';
      tdComment.textContent = r.comment || '—';

      const tdDate = document.createElement('td');
      tdDate.textContent = new Date(r.created_at).toLocaleDateString('fr-FR');
      const badge = document.createElement('div');
      badge.className = 'badge ' + (STATUS_BADGE[r.status] || '');
      badge.textContent = STATUS_LABEL[r.status] || r.status;
      tdDate.appendChild(document.createElement('br'));
      tdDate.appendChild(badge);

      const tdActions = document.createElement('td');
      tdActions.className = 'rv-actions';
      const mkBtn = (label, cls, fn) => {
        const b = document.createElement('button');
        b.className = 'btn btn--sm ' + cls;
        b.textContent = label;
        b.addEventListener('click', fn);
        return b;
      };
      if (r.status !== 'approved') tdActions.appendChild(mkBtn('✅ Approuver', 'btn--success', () => moderate(r.id, 'approved')));
      if (r.status !== 'rejected') tdActions.appendChild(mkBtn('🚫 Rejeter', 'btn--warning', () => moderate(r.id, 'rejected')));
      tdActions.appendChild(mkBtn('🗑️', 'btn--danger', () => removeReview(r.id)));

      tr.append(tdProd, tdAuthor, tdNote, tdComment, tdDate, tdActions);
      body.appendChild(tr);
    });
  } catch (e) {
    rvStatus('Erreur de chargement : ' + e.message, true);
  }
}

async function moderate(id, status) {
  try {
    await api.patch('/api/products?_route=reviews&admin=1', { id, status });
    rvStatus(status === 'approved' ? '✔ Avis approuvé — il est maintenant visible sur la fiche produit.' : '✔ Avis rejeté.');
    await loadReviews();
  } catch (e) {
    rvStatus('Erreur : ' + e.message, true);
  }
}

async function removeReview(id) {
  if (!confirm('Supprimer définitivement cet avis ?')) return;
  try {
    await api.delete(`/api/products?_route=reviews&admin=1&id=${encodeURIComponent(id)}`);
    rvStatus('✔ Avis supprimé.');
    await loadReviews();
  } catch (e) {
    rvStatus('Erreur : ' + e.message, true);
  }
}

async function loadAlerts() {
  const body = document.getElementById('al-body');
  try {
    const list = await api.get('/api/products?_route=stock_alert&admin=1');
    if (!list) return;
    body.replaceChildren();
    if (!list.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.style.cssText = 'text-align:center;color:var(--admin-muted);padding:24px';
      td.textContent = 'Aucune alerte en attente.';
      tr.appendChild(td); body.appendChild(tr);
      return;
    }
    list.forEach(a => {
      const tr = document.createElement('tr');
      const tdProd = document.createElement('td');
      const strong = document.createElement('strong');
      strong.textContent = a.products?.name || '—';
      tdProd.appendChild(strong);
      const tdMail = document.createElement('td');
      tdMail.textContent = a.email;
      const tdDate = document.createElement('td');
      tdDate.textContent = new Date(a.created_at).toLocaleDateString('fr-FR');
      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'badge ' + (a.notified_at ? 'badge--active' : 'badge--pending');
      badge.textContent = a.notified_at ? '📧 Notifié le ' + new Date(a.notified_at).toLocaleDateString('fr-FR') : '🕓 En attente de stock';
      tdStatus.appendChild(badge);
      tr.append(tdProd, tdMail, tdDate, tdStatus);
      body.appendChild(tr);
    });
  } catch (e) {
    body.replaceChildren();
  }
}

document.addEventListener('DOMContentLoaded', () => { loadReviews(); loadAlerts(); });
