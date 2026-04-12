// admin/js/auth.js
let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = window.supabase.createClient(
      window.ADMIN_CONFIG.supabaseUrl,
      window.ADMIN_CONFIG.supabaseAnonKey
    );
  }
  return _supabase;
}

async function getSession() {
  const raw = localStorage.getItem('alkamar_admin_session');
  if (!raw) return null;
  const session = JSON.parse(raw);
  if (session.expires_at && Date.now() / 1000 > session.expires_at) {
    localStorage.removeItem('alkamar_admin_session');
    return null;
  }
  return session;
}

async function requireAuth() {
  const session = await getSession();
  if (!session) window.location.href = '/admin/login.html';
  return session;
}

async function login(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  localStorage.setItem('alkamar_admin_session', JSON.stringify(data.session));
  return data.session;
}

async function logout() {
  const sb = getSupabase();
  await sb.auth.signOut();
  localStorage.removeItem('alkamar_admin_session');
  window.location.href = '/admin/login.html';
}

window.adminAuth = { requireAuth, login, logout, getSession };
