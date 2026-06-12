// admin/js/backups.js — Page Sauvegardes (liste, création, restauration, téléchargement)
'use strict';

const BK_BASE = '/api/products?_route=backup';
let _tables = [];
let _restoreFile = null;

function bkStatus(msg, type) {
  const el = document.getElementById('bk-status');
  el.textContent = msg;
  el.className = 'alert bk-status ' + (type === 'error' ? 'alert--error' : 'alert--success');
  el.style.display = 'block';
}

function fmtDate(name) {
  // backup-2026-06-12-06h00.json → 12/06/2026 à 06h00
  const m = name.match(/backup-(\d{4})-(\d{2})-(\d{2})-(\d{2})h(\d{2})/);
  if (!m) return name;
  return `${m[3]}/${m[2]}/${m[1]} à ${m[4]}h${m[5]} UTC`;
}

async function loadBackups() {
  const body = document.getElementById('bk-body');
  try {
    const data = await api.get(`${BK_BASE}&action=list`);
    if (!data) return;
    _tables = data.tables || [];
    if (!data.files.length) {
      body.replaceChildren();
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.style.cssText = 'text-align:center;color:var(--admin-muted);padding:24px';
      td.textContent = 'Aucune sauvegarde pour le moment. Clique sur « Sauvegarder maintenant » ou attends le prochain cron (00h / 06h).';
      tr.appendChild(td); body.appendChild(tr);
      return;
    }
    body.replaceChildren();
    data.files.forEach(f => {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      const strong = document.createElement('strong');
      strong.textContent = f.name.includes('pre-restore') ? '🛟 ' + f.name : '💾 ' + f.name;
      tdName.appendChild(strong);

      const tdDate = document.createElement('td');
      tdDate.textContent = fmtDate(f.name);

      const tdSize = document.createElement('td');
      tdSize.textContent = f.size_kb >= 1024 ? (f.size_kb / 1024).toFixed(1) + ' Mo' : f.size_kb + ' Ko';

      const tdActions = document.createElement('td');
      tdActions.className = 'bk-actions';
      const mkBtn = (label, cls, fn) => {
        const b = document.createElement('button');
        b.className = 'btn btn--sm ' + cls;
        b.textContent = label;
        b.addEventListener('click', fn);
        return b;
      };
      tdActions.appendChild(mkBtn('♻️ Restaurer', 'btn--warning', () => openRestore(f.name)));
      tdActions.appendChild(mkBtn('⬇️ Télécharger', 'btn--ghost', () => downloadBackup(f.name)));
      tdActions.appendChild(mkBtn('🗑️', 'btn--danger', () => deleteBackup(f.name)));

      tr.append(tdName, tdDate, tdSize, tdActions);
      body.appendChild(tr);
    });
  } catch (e) {
    bkStatus('Erreur de chargement : ' + e.message, 'error');
  }
}

async function runBackup() {
  const btn = document.getElementById('btn-run');
  btn.disabled = true;
  btn.textContent = '⏳ Sauvegarde en cours…';
  try {
    const r = await api.post(`${BK_BASE}&action=run`, {});
    const total = Object.values(r.counts || {}).reduce((s, n) => s + n, 0);
    bkStatus(`✔ Sauvegarde créée : ${r.file} — ${total} lignes, ${r.size_kb} Ko en ${(r.duration_ms / 1000).toFixed(1)}s` +
      (r.warnings?.length ? ` (avertissements : ${r.warnings.join(' · ')})` : ''), 'ok');
    await loadBackups();
  } catch (e) {
    bkStatus('✖ Échec de la sauvegarde : ' + e.message, 'error');
  }
  btn.disabled = false;
  btn.textContent = '⬇️ Sauvegarder maintenant';
}

function openRestore(file) {
  _restoreFile = file;
  document.getElementById('bk-modal-file').textContent = file + ' — ' + fmtDate(file);
  const wrap = document.getElementById('bk-tables');
  wrap.replaceChildren();
  _tables.forEach(t => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = t; cb.checked = true; cb.className = 'row-check';
    label.append(cb, document.createTextNode(' ' + t));
    wrap.appendChild(label);
  });
  document.getElementById('bk-modal').classList.add('is-open');
}

function closeModal() {
  document.getElementById('bk-modal').classList.remove('is-open');
  _restoreFile = null;
}

async function confirmRestore() {
  if (!_restoreFile) return;
  const checked = [...document.querySelectorAll('#bk-tables input:checked')].map(c => c.value);
  if (!checked.length) { alert('Sélectionne au moins une table.'); return; }
  if (!confirm(`Restaurer ${checked.length} table(s) depuis ${_restoreFile} ?\nUne pré-sauvegarde de l'état actuel sera créée d'abord.`)) return;

  const btn = document.getElementById('btn-confirm-restore');
  btn.disabled = true;
  btn.textContent = '⏳ Restauration…';
  try {
    const r = await api.post(`${BK_BASE}&action=restore`, { file: _restoreFile, tables: checked });
    const total = Object.values(r.restored || {}).reduce((s, n) => s + n, 0);
    closeModal();
    bkStatus(`✔ Restauration terminée : ${total} lignes restaurées. Pré-sauvegarde : ${r.pre_restore_backup}` +
      (r.errors?.length ? ` — erreurs : ${r.errors.join(' · ')}` : ''), r.errors?.length ? 'error' : 'ok');
    await loadBackups();
  } catch (e) {
    bkStatus('✖ Échec de la restauration : ' + e.message, 'error');
  }
  btn.disabled = false;
  btn.textContent = '♻️ Restaurer';
}

async function downloadBackup(file) {
  try {
    const r = await api.get(`${BK_BASE}&action=download&file=${encodeURIComponent(file)}`);
    if (r?.url) window.open(r.url, '_blank');
  } catch (e) {
    bkStatus('✖ Téléchargement impossible : ' + e.message, 'error');
  }
}

async function deleteBackup(file) {
  if (!confirm(`Supprimer définitivement ${file} ?`)) return;
  try {
    await api.delete(`${BK_BASE}&action=delete&file=${encodeURIComponent(file)}`);
    bkStatus('✔ Sauvegarde supprimée.', 'ok');
    await loadBackups();
  } catch (e) {
    bkStatus('✖ Suppression impossible : ' + e.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', loadBackups);
