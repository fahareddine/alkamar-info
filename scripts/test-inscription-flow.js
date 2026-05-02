const { chromium } = require('playwright');

const BASE = 'https://alkamar-info.vercel.app';
// Email unique pour ce test
const TS = Date.now();
const TEST_EMAIL = `inscrit${TS}@yopmail.com`;
const TEST_PASS = 'AlkamarTest2026!';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newContext().then(c => c.newPage());

  // ── 1. Lien "Mon compte" topbar ────────────────────────────────────────────
  console.log('1. Vérif lien Mon compte dans topbar...');
  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  const compteLink = await p.$('.topbar__links a[href="/compte.html"], .topbar__links a[href*="compte"]');
  const href = compteLink ? await compteLink.getAttribute('href') : null;
  console.log('  Href:', href, href && href.includes('compte') ? '✅' : '❌ info-experts encore?');
  await p.screenshot({ path: 'scripts/inscr-1-topbar.png' });

  // ── 2. Form inscription — champs obligatoires ──────────────────────────────
  console.log('\n2. Form inscription...');
  await p.goto(BASE + '/inscription.html', { waitUntil: 'networkidle' });
  await p.screenshot({ path: 'scripts/inscr-2-form.png' });

  // Remplir
  await p.fill('#email', TEST_EMAIL);
  await p.fill('#password', TEST_PASS);
  await p.fill('#password2', TEST_PASS);
  await p.fill('#first_name', 'Inscrit');
  await p.fill('#last_name', 'Test');
  await p.fill('#phone', '+269 33 11 111');
  await p.fill('#city', 'Moroni');
  await p.fill('#address', '5 rue des acacias');
  await p.check('#terms');

  await p.click('#register-btn');
  await p.waitForTimeout(5000);
  await p.screenshot({ path: 'scripts/inscr-3-after-submit.png' });

  const urlAfter = p.url();
  const successEl = await p.$('#auth-success');
  const successVisible = successEl ? await successEl.isVisible() : false;
  const successText = successVisible ? await successEl.textContent() : '';
  const errEl = await p.$('#auth-error');
  const errVisible = errEl ? await errEl.isVisible() : false;
  const errText = errVisible ? await errEl.textContent() : '';

  console.log('  URL:', urlAfter);
  console.log('  Succès:', successVisible ? '✅ ' + successText.substring(0, 80) : '—');
  console.log('  Erreur:', errVisible ? '❌ ' + errText : '—');

  const registerOk = successVisible || urlAfter.includes('compte');
  console.log('  Inscription OK:', registerOk ? '✅' : '❌');

  // ── 3. Vérif emailRedirectTo est alkamar (pas localhost) ───────────────────
  console.log('\n3. Check emailRedirectTo dans auth-client.js...');
  const authClientSrc = await p.evaluate(async () => {
    const r = await fetch('/js/auth-client.js');
    return r.text();
  });
  const hasLocalhost = authClientSrc.includes('localhost');
  const hasOrigin = authClientSrc.includes('window.location.origin');
  console.log('  Hardcoded localhost:', hasLocalhost ? '❌ PROBLÈME' : '✅ absent');
  console.log('  window.location.origin dynamique:', hasOrigin ? '✅' : '❌');

  await b.close();

  console.log('\n══ RÉSUMÉ ══');
  console.log('Lien Mon compte topbar:', href?.includes('compte') ? '✅ /compte.html' : '❌ ' + href);
  console.log('Inscription form:', registerOk ? '✅' : '❌');
  console.log('emailRedirectTo dynamique:', hasOrigin && !hasLocalhost ? '✅' : '❌');
  console.log('\nSi inscription OK mais email redirige vers localhost:');
  console.log('→ Supabase Dashboard → Auth → URL Configuration');
  console.log('  Site URL: https://alkamar-info.vercel.app');
  console.log('  Redirect URLs: https://alkamar-info.vercel.app/**');
})();
