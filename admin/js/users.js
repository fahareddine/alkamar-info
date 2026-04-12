// admin/js/users.js
async function init() {
  await adminAuth.requireAuth();
  document.getElementById('show-sql').addEventListener('click', () => {
    const alertEl = document.getElementById('alert');
    const id = document.getElementById('user-id').value.trim();
    const full_name = document.getElementById('full-name').value.trim();
    const role = document.getElementById('role').value;
    if (!id) { alertEl.className = 'alert alert--error'; alertEl.textContent = 'UUID requis'; alertEl.style.display = 'block'; return; }
    alertEl.className = 'alert alert--success';
    alertEl.innerHTML = `Exécuter dans Supabase SQL Editor :<br>
      <code style="font-family:monospace;font-size:12px;word-break:break-all;display:block;margin-top:8px;background:rgba(0,0,0,.3);padding:10px;border-radius:4px">
INSERT INTO user_profiles (id, role, full_name) VALUES ('${id}', '${role}', '${full_name.replace(/'/g, "''")}')
ON CONFLICT (id) DO UPDATE SET role='${role}', full_name='${full_name.replace(/'/g, "''")}';
      </code>`;
    alertEl.style.display = 'block';
  });
}

init();
