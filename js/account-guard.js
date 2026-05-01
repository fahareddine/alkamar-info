// js/account-guard.js — Vérifie auth + profil complet avant checkout
const AccountGuard = {
  async requireAuth(onSuccess) {
    if (typeof AuthClient === 'undefined') { onSuccess(); return; }
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
  },
  async getAuthHeaders() {
    if (typeof AuthClient === 'undefined') return {};
    const session = await AuthClient.getSession();
    if (!session) return {};
    return { 'Authorization': 'Bearer ' + session.access_token };
  },
};
window.AccountGuard = AccountGuard;
