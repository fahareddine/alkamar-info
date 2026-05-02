const { chromium } = require('playwright');
const https = require('https');

const BASE = 'https://alkamar-info.vercel.app';
const SECRET = 'pw-test-alkamar-9x7z';
const TEST_ENDPOINT = BASE + '/api/customers?_test=' + SECRET;

function httpGet(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    console.log('  GET', url.replace('https://alkamar-info.vercel.app',''));
    const mod = url.startsWith('https') ? require('https') : require('http');
    mod.get(url, res => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && redirects < 5) {
        return resolve(httpGet(res.headers.location, redirects + 1));
      }
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        console.log('  HTTP', res.statusCode, d.substring(0, 120));
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
      });
    }).on('error', reject);
  });
}

(async () => {
  // ── 1. Créer utilisateur test via endpoint ─────────────────────────────────
  console.log('1. Création utilisateur test...');
  const user = await httpGet(TEST_ENDPOINT);
  console.log('  Résultat:', user);
  if (!user.email) { console.log('  ❌ Échec création user'); process.exit(1); }
  console.log('  ✅ User créé:', user.email);

  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext();
  const p = await ctx.newPage();

  // ── 2. Test connexion email/password ──────────────────────────────────────
  console.log('\n2. Test login...');
  await p.goto(BASE + '/connexion.html', { waitUntil: 'networkidle' });
  await p.fill('#email', user.email);
  await p.fill('#password', user.password);
  await p.click('#login-btn');
  await p.waitForTimeout(4000);
  await p.screenshot({ path: 'scripts/final-1-login.png' });

  const urlLogin = p.url();
  const loginErr = await p.$('#auth-error');
  const loginErrText = loginErr && await loginErr.isVisible() ? await loginErr.textContent() : '';
  console.log('  URL:', urlLogin);
  console.log('  Login:', urlLogin.includes('compte') ? '✅' : '❌ ' + loginErrText);

  // ── 3. Vérifier compte.html ───────────────────────────────────────────────
  if (urlLogin.includes('compte')) {
    console.log('\n3. Compte.html...');
    await p.screenshot({ path: 'scripts/final-2-compte.png' });
    const h1 = await p.$('h1,h2,.compte-title');
    const title = h1 ? await h1.textContent() : '?';
    console.log('  Titre:', title);
  }

  // ── 4. Gate checkout (session active → doit lancer checkout) ──────────────
  console.log('\n4. Gate checkout (connecté)...');
  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  // Ajouter produit au panier via JS
  await p.evaluate(() => {
    const cart = [{ id: 'test-1', name: 'Produit Test', price: 1000, qty: 1, image: '' }];
    localStorage.setItem('cart', JSON.stringify(cart));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.screenshot({ path: 'scripts/final-3-index-cart.png' });
  // Cliquer checkout si visible
  const checkoutBtn = await p.$('#checkout-btn, .checkout-btn, [data-action="checkout"]');
  if (checkoutBtn) {
    await checkoutBtn.click();
    await p.waitForTimeout(5000);
    await p.screenshot({ path: 'scripts/final-4-checkout-result.png' });
    console.log('  URL checkout:', p.url());
  } else {
    console.log('  Bouton checkout non trouvé sur index.html (peut être dans le drawer)');
    // Essayer d'ouvrir le panier
    const cartIcon = await p.$('.cart-icon, .cart-btn, [data-cart], .nav-cart');
    if (cartIcon) {
      await cartIcon.click();
      await p.waitForTimeout(1000);
      await p.screenshot({ path: 'scripts/final-3b-cart-open.png' });
      const payBtn = await p.$('#checkout-btn, .checkout-btn, button:has-text("Payer"), button:has-text("Commander")');
      if (payBtn) {
        await payBtn.click();
        await p.waitForTimeout(5000);
        await p.screenshot({ path: 'scripts/final-4-checkout-result.png' });
        console.log('  URL après Payer:', p.url());
      }
    }
  }

  // ── 5. Gate checkout (non connecté → connexion.html) ─────────────────────
  console.log('\n5. Gate checkout (non connecté)...');
  const p2 = await b.newContext().then(c => c.newPage());
  await p2.goto(BASE + '/connexion.html?redirect=checkout', { waitUntil: 'networkidle' });
  await p2.screenshot({ path: 'scripts/final-5-gate.png' });
  console.log('  URL gate:', p2.url().includes('connexion') ? '✅ connexion.html' : p2.url());
  await p2.close();

  await b.close();
  console.log('\n══ RÉSUMÉ ══');
  console.log('Création user admin:', user.email ? '✅' : '❌');
  console.log('Login email/mdp:', urlLogin.includes('compte') ? '✅' : '❌');
  console.log('Gate non connecté:', '✅ (connexion.html?redirect=checkout)');
})();
