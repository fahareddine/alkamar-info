const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();

  // Attendre le deploy
  await p.goto('https://alkamar-info.vercel.app/connexion.html', { waitUntil: 'networkidle' });

  // Test 1: mauvais credentials → doit afficher en français
  await p.fill('#email', 'inexistant@test.com');
  await p.fill('#password', 'wrongpass');
  await p.click('#login-btn');
  await p.waitForTimeout(3000);
  const errEl = await p.$('#auth-error');
  const errText = errEl ? await errEl.textContent() : '';
  const isFrench = errText.includes('incorrect') || errText.includes('Email') || errText.includes('mot de passe');
  console.log('1. Erreur mauvais credentials:', errText);
  console.log('   En français:', isFrench ? '✅' : '❌');
  await p.screenshot({ path: 'scripts/err-1-login.png' });

  // Test 2: inscription — erreur déjà existant
  const p2 = await b.newContext().then(c => c.newPage());
  await p2.goto('https://alkamar-info.vercel.app/inscription.html', { waitUntil: 'networkidle' });
  await p2.fill('#email', 'playwright@test-alkamar.internal');
  await p2.fill('#password', 'TestAlkamar2026!');
  await p2.fill('#password2', 'TestAlkamar2026!');
  await p2.fill('#first_name', 'Test');
  await p2.fill('#last_name', 'User');
  await p2.fill('#phone', '+269 33 00 001');
  await p2.fill('#city', 'Moroni');
  await p2.fill('#address', '1 rue test');
  await p2.check('#terms');
  await p2.click('#register-btn');
  await p2.waitForTimeout(4000);
  const errEl2 = await p2.$('#auth-error');
  const errText2 = errEl2 && await errEl2.isVisible() ? await errEl2.textContent() : '(aucune erreur visible)';
  const successEl2 = await p2.$('#auth-success');
  const successVisible2 = successEl2 ? await successEl2.isVisible() : false;
  console.log('2. Inscription compte existant:', errText2 || (successVisible2 ? '(email confirmation envoyé)' : '?'));
  await p2.screenshot({ path: 'scripts/err-2-inscription.png' });
  await p2.close();

  await b.close();
})();
