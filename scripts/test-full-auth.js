const { chromium } = require('playwright');
const https = require('https');

const SUPABASE_URL = 'https://ovjsinugxkuwsjnfxfgb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92anNpbnVneGt1d3NqbmZ4ZmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODkxMTMsImV4cCI6MjA5MTU2NTExM30.H45Z2tGvjTaXIpEj-gVpPKLEpNXEDKVZPFJWcoIzj0Y';
const TEST_EMAIL = 'playwright.test.' + Date.now() + '@yopmail.com';
const TEST_PASS = 'TestAlkamar2026!';

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(SUPABASE_URL + path);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // ── 1. Créer compte test via Supabase API ─────────────────────────────────
  console.log('Création compte test:', TEST_EMAIL);
  const signup = await apiCall('POST', '/auth/v1/signup', { email: TEST_EMAIL, password: TEST_PASS });
  console.log('Signup status:', signup.status);

  const needsConfirm = !signup.body?.access_token;
  if (needsConfirm) {
    console.log('⚠️  Email confirmation requise. Vérification via yopmail...');
    // On ne peut pas confirmer l'email automatiquement
    // On va tester avec un compte existant via inscription.html
  } else {
    console.log('✅ Compte créé avec session immédiate (pas de confirmation email)');
  }

  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext();
  const p = await ctx.newPage();

  // ── 2. Test inscription.html ──────────────────────────────────────────────
  console.log('\n── Test inscription ──');
  await p.goto('https://alkamar-info.vercel.app/inscription.html', { waitUntil: 'networkidle' });
  await p.screenshot({ path: 'scripts/auth-1-inscription.png' });

  const regEmail = 'pw.test.' + Date.now() + '@yopmail.com';
  await p.fill('#email', regEmail);
  await p.fill('#password', TEST_PASS);
  // Remplir le profil si présent
  const fn = await p.$('#first_name');
  if (fn) {
    await p.fill('#first_name', 'Test');
    await p.fill('#last_name', 'Playwright');
    await p.fill('#phone', '3330000001');
    await p.fill('#city', 'Moroni');
    await p.fill('#address', '1 rue test');
    const terms = await p.$('#terms');
    if (terms) await terms.check();
  }
  await p.click('button[type="submit"]');
  await p.waitForTimeout(3000);
  await p.screenshot({ path: 'scripts/auth-2-after-inscription.png' });
  const urlAfterReg = p.url();
  console.log('URL après inscription:', urlAfterReg);

  // Analyser résultat
  const onCompte = urlAfterReg.includes('compte.html');
  const onIndex = urlAfterReg.includes('index.html');
  const stillOnInscription = urlAfterReg.includes('inscription');
  const successMsg = await p.$('#auth-success');
  const successVisible = successMsg ? await successMsg.isVisible() : false;
  const errMsg = await p.$('#auth-error');
  const errVisible = errMsg ? await errMsg.isVisible() : false;
  const errText = errVisible ? await errMsg.textContent() : '';

  console.log('Redirigé vers compte.html:', onCompte ? '✅' : '❌');
  console.log('Message succès:', successVisible ? '✅ ' + await successMsg.textContent() : '—');
  console.log('Erreur:', errVisible ? '❌ ' + errText : '—');

  // ── 3. Test connexion email/password ──────────────────────────────────────
  console.log('\n── Test connexion page ──');
  await p.goto('https://alkamar-info.vercel.app/connexion.html', { waitUntil: 'networkidle' });
  await p.fill('#email', regEmail);
  await p.fill('#password', TEST_PASS);
  await p.click('#login-btn');
  await p.waitForTimeout(3000);
  await p.screenshot({ path: 'scripts/auth-3-after-login.png' });
  const urlAfterLogin = p.url();
  console.log('URL après login:', urlAfterLogin);
  const loginOk = urlAfterLogin.includes('compte.html') || urlAfterLogin.includes('index.html');
  const loginErrEl = await p.$('#auth-error');
  const loginErrVisible = loginErrEl ? await loginErrEl.isVisible() : false;
  const loginErrText = loginErrVisible ? await loginErrEl.textContent() : '';
  console.log('Login OK:', loginOk ? '✅' : '❌ ' + loginErrText);

  // ── 4. Test gate checkout ─────────────────────────────────────────────────
  console.log('\n── Test gate checkout ──');
  const p2 = await ctx.newPage();
  // Vider session
  await p2.goto('https://alkamar-info.vercel.app/index.html', { waitUntil: 'networkidle' });
  // Simuler clic Payer (checkout)
  await p2.goto('https://alkamar-info.vercel.app/index.html?checkout=1', { waitUntil: 'networkidle' });
  await p2.waitForTimeout(2000);
  await p2.screenshot({ path: 'scripts/auth-4-checkout.png' });
  console.log('URL checkout:', p2.url());

  await b.close();
  console.log('\n── Résumé ──');
  console.log('Inscription → compte.html:', onCompte ? '✅' : successVisible ? '✅ (email confirm requis)' : '❌');
  console.log('Login email/mdp:', loginOk ? '✅' : '❌');
  console.log('Gate checkout:', 'voir screenshot auth-4');
})();
