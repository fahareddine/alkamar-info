// js/account-guard.js — Vérifie auth + profil complet avant checkout
const AccountGuard = {
  async requireAuth(onSuccess) {
    if (typeof AuthClient === 'undefined') {
      // AuthClient non chargé → connexion requise par sécurité
      sessionStorage.setItem('checkout_pending', '1');
      window.location.href = '/connexion.html?redirect=checkout';
      return;
    }
    try {
      const session = await AuthClient.getSession();
      if (!session) {
        sessionStorage.setItem('checkout_pending', '1');
        window.location.href = '/connexion.html?redirect=checkout';
        return;
      }
      const complete = await AuthClient.isProfileComplete();
      if (!complete) {
        sessionStorage.setItem('checkout_pending', '1');
        window.location.href = '/compte.html?incomplete=1';
        return;
      }
      onSuccess();
    } catch(e) {
      // Erreur init Supabase (CDN non chargé, etc.) → connexion requise
      console.warn('[AccountGuard] Erreur auth:', e.message);
      sessionStorage.setItem('checkout_pending', '1');
      window.location.href = '/connexion.html?redirect=checkout';
    }
  },
  async getAuthHeaders() {
    if (typeof AuthClient === 'undefined') return {};
    const session = await AuthClient.getSession();
    if (!session) return {};
    return { 'Authorization': 'Bearer ' + session.access_token };
  },
};
window.AccountGuard = AccountGuard;
