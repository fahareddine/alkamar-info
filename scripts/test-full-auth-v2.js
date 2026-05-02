const { chromium } = require('playwright');

const TS = Date.now();
const USER = 'alktest' + TS;
const TEST_EMAIL = USER + '@yopmail.com';
const TEST_PASS = 'TestAlkamar2026!';

(async () => {
  const b = await chromium.launch({ headless: true, slowMo: 100 });
  const ctx = await b.newContext();
  const p = await ctx.newPage();

  // ── 1. Inscription ─────────────────────────────────────────────────────────
  console.log('1. Inscription avec', TEST_EMAIL);
  await p.goto('https://alkamar-info.vercel.app/inscription.html', { waitUntil: 'networkidle' });

  await p.fill('#email', TEST_EMAIL);
  await p.fill('#password', TEST_PASS);
  await p.fill('#password2', TEST_PASS);          // <-- champ confirmé
  await p.fill('#first_name', 'Test');
  await p.fill('#last_name', 'Playwright');
  await p.fill('#phone', '+269 33 00 001');
  await p.fill('#city', 'Moroni');
  await p.fill('#address', '1 rue des tests');
  await p.check('#terms');

  await p.click('#register-btn');
  await p.waitForTimeout(4000);

  await p.screenshot({ path: 'scripts/v2-1-after-register.png' });

  const urlAfterReg = p.url();
  const successEl = await p.$('#auth-success');
  const successVisible = successEl ? await successEl.isVisible() : false;
  const errEl = await p.$('#auth-error');
  const errVisible = errEl ? await errEl.isVisible() : false;
  const errText = errVisible ? await errEl.textContent() : '';

  console.log('  URL:', urlAfterReg);
  console.log('  Session immédiate (→ compte.html):', urlAfterReg.includes('compte') ? '✅' : '—');
  console.log('  Email confirm requis:', successVisible ? '⚠️  oui' : '—');
  console.log('  Erreur:', errText || '—');

  // ── 2. Si email confirmation requise → yopmail ────────────────────────────
  if (successVisible && !urlAfterReg.includes('compte')) {
    console.log('\n2. Récupération email de confirmation sur yopmail...');
    const yop = await ctx.newPage();
    await yop.goto('https://yopmail.com/en/', { waitUntil: 'networkidle' });

    // Saisir le nom d'utilisateur
    await yop.fill('#login', USER);
    await yop.click('.sbut');
    await yop.waitForTimeout(4000);
    await yop.screenshot({ path: 'scripts/v2-2-yopmail.png' });

    // Chercher email dans iframe
    let confirmUrl = null;
    try {
      const mailFrame = yop.frame({ name: 'ifmail' }) || yop.frames().find(f => f.name() === 'ifmail');
      if (mailFrame) {
        await mailFrame.waitForSelector('a[href*="supabase"]', { timeout: 10000 });
        confirmUrl = await mailFrame.$eval('a[href*="supabase"]', el => el.href);
      } else {
        // Essayer de trouver dans tous les frames
        for (const frame of yop.frames()) {
          try {
            const link = await frame.$('a[href*="supabase"]');
            if (link) { confirmUrl = await link.getAttribute('href'); break; }
          } catch {}
        }
      }
    } catch (e) {
      console.log('  ⚠️ Pas de mail trouvé dans yopmail:', e.message);
    }

    await yop.screenshot({ path: 'scripts/v2-3-yopmail-inbox.png' });

    if (confirmUrl) {
      console.log('  Lien confirmation trouvé ✅');
      await p.goto(confirmUrl, { waitUntil: 'networkidle' });
      await p.waitForTimeout(3000);
      await p.screenshot({ path: 'scripts/v2-4-after-confirm.png' });
      console.log('  URL après confirmation:', p.url());
    } else {
      console.log('  ❌ Lien non trouvé. Vérification du header refresh...');
      // Parfois yopmail recharge automatiquement
      await yop.waitForTimeout(6000);
      await yop.screenshot({ path: 'scripts/v2-3b-yopmail-retry.png' });

      for (const frame of yop.frames()) {
        try {
          const links = await frame.$$('a');
          for (const l of links) {
            const href = await l.getAttribute('href');
            if (href && href.includes('supabase')) { confirmUrl = href; break; }
          }
          if (confirmUrl) break;
        } catch {}
      }

      if (confirmUrl) {
        console.log('  Lien confirmation trouvé (retry) ✅');
        await p.goto(confirmUrl, { waitUntil: 'networkidle' });
        await p.waitForTimeout(3000);
        await p.screenshot({ path: 'scripts/v2-4-after-confirm.png' });
        console.log('  URL après confirmation:', p.url());
      } else {
        console.log('  ❌ Impossible de récupérer le lien depuis yopmail.');
      }
    }

    await yop.close();
  }

  // ── 3. Login ───────────────────────────────────────────────────────────────
  console.log('\n3. Test login...');
  await p.goto('https://alkamar-info.vercel.app/connexion.html', { waitUntil: 'networkidle' });
  await p.fill('#email', TEST_EMAIL);
  await p.fill('#password', TEST_PASS);
  await p.click('#login-btn');
  await p.waitForTimeout(4000);
  await p.screenshot({ path: 'scripts/v2-5-after-login.png' });

  const urlLogin = p.url();
  const loginErr = await p.$('#auth-error');
  const loginErrVisible = loginErr ? await loginErr.isVisible() : false;
  const loginErrText = loginErrVisible ? await loginErr.textContent() : '';
  console.log('  URL:', urlLogin);
  console.log('  Login OK:', urlLogin.includes('compte') || urlLogin.includes('index') ? '✅' : '❌ ' + loginErrText);

  // ── 4. Compte.html ─────────────────────────────────────────────────────────
  if (urlLogin.includes('compte')) {
    console.log('\n4. Vérification compte.html...');
    await p.screenshot({ path: 'scripts/v2-6-compte.png' });
    const incomplete = await p.$('.alert-incomplete, [class*="incomplete"]');
    console.log('  Profil incomplet alerte:', incomplete ? '⚠️' : '—');
  }

  // ── 5. Gate checkout non connecté ─────────────────────────────────────────
  console.log('\n5. Test gate checkout (session inconnue)...');
  const p3 = await b.newContext().then(c => c.newPage());
  await p3.goto('https://alkamar-info.vercel.app/connexion.html?redirect=checkout', { waitUntil: 'networkidle' });
  await p3.screenshot({ path: 'scripts/v2-7-gate.png' });
  console.log('  Page gate:', p3.url().includes('connexion') ? '✅' : p3.url());
  await p3.close();

  await b.close();
  console.log('\n══ DONE ══');
})();
