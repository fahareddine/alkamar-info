// admin/js/api.js
const api = {
  async _fetch(path, options = {}) {
    const session = JSON.parse(localStorage.getItem('alkamar_admin_session') || 'null');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

    const res = await fetch(window.ADMIN_CONFIG.apiBase + path, { ...options, headers });
    if (res.status === 401) { window.location.href = '/admin/login.html'; return null; }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Erreur serveur');
    }
    return res.status === 204 ? null : res.json();
  },
  get: (path) => api._fetch(path),
  post: (path, body) => api._fetch(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => api._fetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => api._fetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => api._fetch(path, { method: 'DELETE' }),
};
