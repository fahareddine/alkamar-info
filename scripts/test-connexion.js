const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();

  // Deploy d'abord : on teste prod après push
  // Test 1: Page screenshot (local via vercel dev si dispo, sinon prod après deploy)
  await p.goto('https://alkamar-info.vercel.app/connexion.html', { waitUntil: 'networkidle' });
  await p.screenshot({ path: 'scripts/connexion-fix.png', fullPage: true });
  console.log('1. Page chargée');

  // Test 2: Boutons désactivés présents
  const btns = await p.$$('button[disabled]');
  console.log('2. Boutons disabled:', btns.length, btns.length >= 2 ? '✅' : '❌');

  // Test 3: Clic Google ne navigue pas vers supabase
  const pageBefore = p.url();
  if (btns.length > 0) await btns[0].click({ force: true });
  await p.waitForTimeout(1000);
  const pageAfter = p.url();
  console.log('3. URL inchangée après clic Google:', pageAfter === pageBefore ? '✅' : '❌ → ' + pageAfter);

  // Test 4: Login email mauvais mdp reste sur page
  await p.fill('#email', 'test@test.com');
  await p.fill('#password', 'wrongpassword');
  await p.click('#login-btn');
  await p.waitForTimeout(2500);
  const errEl = await p.$('#auth-error');
  const errVisible = errEl ? await errEl.isVisible() : false;
  console.log('4. Erreur affichée (reste page):', errVisible ? '✅' : '❌');
  console.log('   URL:', p.url());

  await b.close();
})();
