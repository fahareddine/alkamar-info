const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();

  // Attendre deploy
  await p.goto('https://alkamar-info.vercel.app/connexion.html', { waitUntil: 'networkidle' });
  await p.screenshot({ path: 'scripts/oauth-active.png', fullPage: true });

  // Vérifier boutons actifs (pas disabled)
  const googleDisabled = await p.$eval('button.auth-btn--google', el => el.disabled);
  const msDisabled = await p.$eval('button.auth-btn--microsoft', el => el.disabled);
  console.log('1. Google actif:', !googleDisabled ? '✅' : '❌');
  console.log('2. Microsoft actif:', !msDisabled ? '✅' : '❌');

  // Clic Google → doit aller vers accounts.google.com ou supabase OAuth (pas erreur)
  const [popup] = await Promise.all([
    p.waitForNavigation({ timeout: 8000 }).catch(() => null),
    p.click('button.auth-btn--google'),
  ]);
  await p.waitForTimeout(3000);
  const urlAfter = p.url();
  const isSupabaseError = urlAfter.includes('error_code=validation_failed');
  const isGoogleAuth = urlAfter.includes('accounts.google.com') || urlAfter.includes('supabase.co/auth') && !isSupabaseError;
  console.log('3. URL après clic Google:', urlAfter.substring(0, 80));
  console.log('   Erreur Supabase "provider not enabled":', isSupabaseError ? '❌ ENCORE PRÉSENT' : '✅ ABSENT');

  await b.close();
})();
