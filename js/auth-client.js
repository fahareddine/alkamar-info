// js/auth-client.js — Client Supabase Auth côté client
const SUPABASE_URL  = 'https://ovjsinugxkuwsjnfxfgb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92anNpbnVneGt1d3NqbmZ4ZmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODkxMTMsImV4cCI6MjA5MTU2NTExM30.H45Z2tGvjTaXIpEj-gVpPKLEpNXEDKVZPFJWcoIzj0Y';

let _sb = null;
function getSB() {
  if (_sb) return _sb;
  if (typeof supabase === 'undefined') throw new Error('Supabase CDN non chargé');
  _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return _sb;
}

const AuthClient = {
  async getSession() {
    const { data } = await getSB().auth.getSession();
    return data.session;
  },
  async getUser() {
    const { data } = await getSB().auth.getUser();
    return data.user;
  },
  async signUp(email, password) {
    return getSB().auth.signUp({ email, password,
      options: { emailRedirectTo: window.location.origin + '/connexion.html?verified=1' }
    });
  },
  async signIn(email, password) {
    return getSB().auth.signInWithPassword({ email, password });
  },
  async resetPassword(email) {
    return getSB().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/mot-de-passe-oublie.html?reset=1'
    });
  },
  async updatePassword(newPassword) {
    return getSB().auth.updateUser({ password: newPassword });
  },
  async signInWithGoogle() {
    return getSB().auth.signInWithOAuth({ provider: 'google',
      options: { redirectTo: window.location.origin + '/compte.html' }
    });
  },
  async signInWithMicrosoft() {
    return getSB().auth.signInWithOAuth({ provider: 'azure',
      options: { redirectTo: window.location.origin + '/compte.html' }
    });
  },
  async signOut() {
    await getSB().auth.signOut();
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
  async isProfileComplete() {
    const p = await this.getProfile();
    if (!p) return false;
    return !!(p.first_name && p.last_name && p.phone && p.city && p.address && p.terms_accepted_at);
  },
};

window.AuthClient = AuthClient;
