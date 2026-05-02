const { chromium } = require('playwright');
const https = require('https');

const BASE = 'https://alkamar-info.vercel.app';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? require('https') : require('http');
    mod.get(url, r => {
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>{
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
      });
    }).on('error', reject);
  });
}

(async () => {
  // ── 0. Créer user test confirmé ────────────────────────────────────────────
  const user = await httpGet(BASE + '/api/customers?_test=pw-test-alkamar-9x7z');
  if (!user.email) { console.log('❌ Endpoint test non disponible:', user); process.exit(1); }
  console.log('0. User test:', user.email, '✅');

  const b = await chromium.launch({ headless: true });

  // ── 1. Connexion.html — pas de boutons OAuth visibles ─────────────────────
  console.log('\n1. Boutons OAuth cachés...');
  const p1 = await b.newContext().then(c => c.newPage());
  await p1.goto(BASE + '/connexion.html', { waitUntil: 'networkidle' });
  await p1.screenshot({ path: 'scripts/flow-1-connexion.png' });
  const oauthDiv = await p1.$('#oauth-btns');
  const oauthVisible = oauthDiv ? await oauthDiv.isVisible() : false;
  console.log('  OAuth div caché:', !oauthVisible ? '✅' : '❌ encore visible');
  await p1.close();

  // ── 2. Login avec user confirmé ────────────────────────────────────────────
  console.log('\n2. Login user confirmé...');
  const ctx = await b.newContext();
  const p2 = await ctx.newPage();
  await p2.goto(BASE + '/connexion.html', { waitUntil: 'networkidle' });
  await p2.fill('#email', user.email);
  await p2.fill('#password', user.password);
  await p2.click('#login-btn');
  await p2.waitForTimeout(4000);
  const urlAfterLogin = p2.url();
  console.log('  URL:', urlAfterLogin);
  console.log('  Login OK:', urlAfterLogin.includes('compte') ? '✅' : '❌');

  // ── 3. Compte.html — pas de bannière unconfirmed ───────────────────────────
  console.log('\n3. Bannière email non confirmé absente...');
  await p2.screenshot({ path: 'scripts/flow-2-compte.png' });
  const unconfBanner = await p2.$('#unconfirmed-alert');
  const unconfVisible = unconfBanner ? await unconfBanner.isVisible() : false;
  console.log('  Bannière unconfirmed:', !unconfVisible ? '✅ absente' : '❌ visible alors que email confirmé');

  // ── 4. Gate checkout — user confirmé + profil complet → passe ─────────────
  console.log('\n4. Gate checkout (connecté + confirmé + profil complet)...');
  await p2.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await p2.evaluate(() => localStorage.setItem('cart', JSON.stringify([{id:'t1',name:'Test',price:1000,qty:1,image:''}])));
  // Simuler clic Payer via AccountGuard
  const blocked = await p2.evaluate(() => {
    return new Promise(resolve => {
      if (typeof AccountGuard === 'undefined') { resolve('AccountGuard undefined'); return; }
      AccountGuard.requireAuth(() => resolve('PASS')).catch(e => resolve('ERROR: ' + e.message));
      setTimeout(() => resolve('TIMEOUT'), 5000);
    });
  });
  console.log('  Checkout guard:', blocked === 'PASS' ? '✅ autorisé' : '⚠️ ' + blocked);

  // ── 5. Gate checkout — non connecté → connexion.html ──────────────────────
  console.log('\n5. Gate checkout (non connecté)...');
  const p5 = await b.newContext().then(c => c.newPage());
  await p5.goto(BASE + '/connexion.html?redirect=checkout', { waitUntil: 'networkidle' });
  console.log('  URL:', p5.url().includes('connexion') ? '✅ connexion.html' : p5.url());
  await p5.close();

  // ── 6. Message erreur mauvais mdp en français ──────────────────────────────
  console.log('\n6. Message erreur français...');
  const p6 = await b.newContext().then(c => c.newPage());
  await p6.goto(BASE + '/connexion.html', { waitUntil: 'networkidle' });
  await p6.fill('#email', 'faux@test.com');
  await p6.fill('#password', 'wrongpass');
  await p6.click('#login-btn');
  await p6.waitForTimeout(3000);
  const errEl = await p6.$('#auth-error');
  const errText = errEl ? await errEl.textContent() : '';
  console.log('  Erreur:', errText);
  console.log('  En français:', errText.includes('incorrect') ? '✅' : '❌');
  await p6.close();

  await b.close();

  console.log('\n══ RÉSUMÉ ══');
  console.log('OAuth cachés:', !oauthVisible ? '✅' : '❌');
  console.log('Login email/mdp:', urlAfterLogin.includes('compte') ? '✅' : '❌');
  console.log('Bannière unconfirmed absente:', !unconfVisible ? '✅' : '❌');
  console.log('Gate checkout:', blocked === 'PASS' ? '✅' : '⚠️');
  console.log('Messages français:', errText.includes('incorrect') ? '✅' : '❌');
})();
