// admin/js/relances.js — Relance des commandes Stripe non payées
'use strict';

function rlStatus(msg, isError) {
  const el = document.getElementById('rl-status');
  el.textContent = msg;
  el.className = 'alert ' + (isError ? 'alert--error' : 'alert--success');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function hoursAgo(iso) {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 36e5);
  if (h < 1) return "moins d'1h";
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.round(h / 24)} j`;
}

async function loadUnpaid() {
  const body = document.getElementById('rl-body');
  try {
    const list = await api.get('/api/orders/unpaid');
    if (!list) return;
    body.replaceChildren();
    if (!list.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.style.cssText = 'text-align:center;color:var(--admin-muted);padding:24px';
      td.textContent = 'Aucune commande à relancer. 🎉';
      tr.appendChild(td); body.appendChild(tr);
      return;
    }
    list.forEach(o => {
      const tr = document.createElement('tr');

      const tdNum = document.createElement('td');
      const link = document.createElement('a');
      link.href = '/admin/orders/detail.html?id=' + o.id;
      link.textContent = '#' + o.id.slice(0, 8).toUpperCase();
      link.style.fontWeight = '600';
      tdNum.appendChild(link);

      const tdClient = document.createElement('td');
      const name = document.createElement('div');
      name.textContent = o.customer_name || '—';
      name.style.fontWeight = '600';
      const mail = document.createElement('div');
      mail.textContent = o.customer_email;
      mail.style.cssText = 'font-size:12px;color:var(--admin-muted)';
      tdClient.append(name, mail);

      const tdTotal = document.createElement('td');
      tdTotal.textContent = Number(o.total_eur).toFixed(2).replace('.', ',') + ' €';
      tdTotal.style.fontWeight = '700';

      const tdDate = document.createElement('td');
      tdDate.textContent = hoursAgo(o.created_at);

      const tdReminded = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'badge ' + (o.reminder_sent_at ? 'badge--confirmed' : 'badge--draft');
      badge.textContent = o.reminder_sent_at
        ? '📧 Relancé ' + hoursAgo(o.reminder_sent_at)
        : 'Jamais relancé';
      tdReminded.appendChild(badge);

      const tdAction = document.createElement('td');
      const btn = document.createElement('button');
      btn.className = 'btn btn--sm ' + (o.reminder_sent_at ? 'btn--ghost' : 'btn--primary');
      btn.textContent = o.reminder_sent_at ? '↩️ Relancer encore' : '📧 Relancer';
      btn.addEventListener('click', () => remind(o, btn));
      tdAction.appendChild(btn);

      tr.append(tdNum, tdClient, tdTotal, tdDate, tdReminded, tdAction);
      body.appendChild(tr);
    });
  } catch (e) {
    rlStatus('Erreur de chargement : ' + e.message, true);
  }
}

async function remind(order, btn) {
  if (!confirm(`Envoyer un email de relance avec lien de paiement à ${order.customer_email} ?`)) return;
  btn.disabled = true;
  btn.textContent = '⏳ Envoi…';
  try {
    const r = await api.post('/api/orders?action=remind', { order_id: order.id });
    rlStatus(r.skipped
      ? '⚠ Email non envoyé (mode test ou clé manquante) — lien Stripe régénéré.'
      : `✔ Relance envoyée à ${r.sent_to} avec un nouveau lien de paiement.`);
    await loadUnpaid();
  } catch (e) {
    rlStatus('✖ Échec : ' + e.message, true);
    btn.disabled = false;
    btn.textContent = '📧 Relancer';
  }
}

document.addEventListener('DOMContentLoaded', loadUnpaid);
