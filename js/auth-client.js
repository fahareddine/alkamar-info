// js/auth-client.js — Client Supabase Auth côté client
// Supabase chargé à la demande — ne bloque pas le thread principal au démarrage
const SUPABASE_URL  = 'https://ovjsinugxkuwsjnfxfgb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92anNpbnVneGt1d3NqbmZ4ZmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODkxMTMsImV4cCI6MjA5MTU2NTExM30.H45Z2tGvjTaXIpEj-gVpPKLEpNXEDKVZPFJWcoIzj0Y';

let _sb = null;
let _supabaseLoad = null;

async function ensureSupabase() {
  if (typeof supabase !== 'undefined') return;
  if (!_supabaseLoad) {
    _supabaseLoad = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Supabase CDN non disponible'));
      document.head.appendChild(s);
    });
  }
  return _supabaseLoad;
}

async function getSB() {
  if (_sb) return _sb;
  await ensureSupabase();
  _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return _sb;
}

const AuthClient = {
  async getSession() {
    const { data } = await (await getSB()).auth.getSession();
    return data.session;
  },
  async getUser() {
    const { data } = await (await getSB()).auth.getUser();
    return data.user;
  },
  async signUp(email, password) {
    return (await getSB()).auth.signUp({ email, password,
      options: { emailRedirectTo: window.location.origin + '/connexion.html?verified=1' }
    });
  },
  async signIn(email, password) {
    return (await getSB()).auth.signInWithPassword({ email, password });
  },
  async resetPassword(email) {
    return (await getSB()).auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/mot-de-passe-oublie.html?reset=1'
    });
  },
  async updatePassword(newPassword) {
    return (await getSB()).auth.updateUser({ password: newPassword });
  },
  async signInWithGoogle() {
    return (await getSB()).auth.signInWithOAuth({ provider: 'google',
      options: { redirectTo: window.location.origin + '/compte.html' }
    });
  },
  async signInWithMicrosoft() {
    return (await getSB()).auth.signInWithOAuth({ provider: 'azure',
      options: { redirectTo: window.location.origin + '/compte.html' }
    });
  },
  async signOut() {
    await (await getSB()).auth.signOut();
    window.location.href = '/index.html';
  },
  async getProfile() {
    const session = await this.getSession();
    if (!session) return null;
    const res = await fetch('/api/customers?profile=1', {
      headers: { 'Authorization': 'Bearer ' + session.access_token }
    });
    if (!res.ok) return null;
    return res.json();
  },
  async saveProfile(data) {
    const session = await this.getSession();
    if (!session) throw new Error('Non connecté');
    const res = await fetch('/api/customers?profile=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async isEmailConfirmed() {
    const user = await this.getUser();
    if (!user) return false;
    return !!user.email_confirmed_at;
  },
  async isProfileComplete() {
    const p = await this.getProfile();
    if (!p) return false;
    return !!(p.first_name && p.last_name && p.phone && p.city && p.address && p.terms_accepted_at);
  },
};

window.AuthClient = AuthClient;
