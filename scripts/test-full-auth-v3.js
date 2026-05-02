const { chromium } = require('playwright');

const TS = Date.now();
const USER = 'alktest' + TS;
const TEST_EMAIL = USER + '@yopmail.com';
const TEST_PASS = 'TestAlkamar2026!';

async function dismissConsent(page) {
  try {
    // CookieFirst / Didomi / custom consent
    const consentSelectors = [
      'button:has-text("Consent")',
      'button:has-text("Accept")',
      'button:has-text("OK")',
      '.fc-cta-consent',
      '[aria-label="Consent"]',
      'button.fc-button.fc-cta-consent',
    ];
    for (const sel of consentSelectors) {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); await page.waitForTimeout(1000); return; }
    }
  } catch {}
}

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext();
  const p = await ctx.newPage();

  // ── 1. Inscription ─────────────────────────────────────────────────────────
  console.log('1. Inscription:', TEST_EMAIL);
  await p.goto('https://alkamar-info.vercel.app/inscription.html', { waitUntil: 'networkidle' });

  await p.fill('#email', TEST_EMAIL);
  await p.fill('#password', TEST_PASS);
  await p.fill('#password2', TEST_PASS);
  await p.fill('#first_name', 'Test');
  await p.fill('#last_name', 'Playwright');
  await p.fill('#phone', '+269 33 00 001');
  await p.fill('#city', 'Moroni');
  await p.fill('#address', '1 rue des tests');
  await p.check('#terms');
  await p.click('#register-btn');
  await p.waitForTimeout(4000);

  const urlReg = p.url();
  const successEl = await p.$('#auth-success');
  const successVisible = successEl ? await successEl.isVisible() : false;
  const errEl = await p.$('#auth-error');
  const errText = errEl && await errEl.isVisible() ? await errEl.textContent() : '';
  console.log('  URL:', urlReg);
  console.log('  Compte direct:', urlReg.includes('compte') ? '✅' : '—');
  console.log('  Email confirm requis:', successVisible ? '⚠️' : '—');
  console.log('  Erreur:', errText || '—');

  if (urlReg.includes('compte')) {
    console.log('\n✅ Inscription directe sans confirmation email !');
    goto_login_test(p, b, TEST_EMAIL, TEST_PASS);
    return;
  }

  // ── 2. YOPmail — récupérer lien confirmation ──────────────────────────────
  console.log('\n2. YOPmail: cherche lien confirmation...');
  const yop = await ctx.newPage();

  // Accès direct inbox via URL
  await yop.goto('https://yopmail.com/?'+USER, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await yop.waitForTimeout(2000);
  await dismissConsent(yop);
  await yop.waitForTimeout(2000);

  // Remplir le champ login et soumettre
  try {
    await yop.fill('#login', USER, { timeout: 5000 });
    await yop.keyboard.press('Enter');
    await yop.waitForTimeout(4000);
  } catch (e) {
    console.log('  Champ login non trouvé:', e.message);
  }

  await yop.screenshot({ path: 'scripts/v3-yopmail.png' });

  // Chercher le lien Supabase dans tous les frames
  let confirmUrl = null;
  await yop.waitForTimeout(5000);

  for (const frame of yop.frames()) {
    try {
      const links = await frame.$$('a[href]');
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href && (href.includes('supabase') || href.includes('confirm') || href.includes('verify'))) {
          confirmUrl = href;
          console.log('  Lien trouvé:', href.substring(0, 80));
          break;
        }
      }
      if (confirmUrl) break;
    } catch {}
  }

  // Essayer aussi le contenu texte des frames pour les mails en plaintext
  if (!confirmUrl) {
    for (const frame of yop.frames()) {
      try {
        const text = await frame.textContent('body');
        const match = text.match(/https:\/\/[^\s"<>]+confirm[^\s"<>]*/);
        if (match) { confirmUrl = match[0]; console.log('  Lien (texte):', confirmUrl.substring(0, 80)); break; }
      } catch {}
    }
  }

  await yop.close();

  if (confirmUrl) {
    console.log('\n3. Confirmation email...');
    await p.goto(confirmUrl, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
    await p.screenshot({ path: 'scripts/v3-confirmed.png' });
    console.log('  URL après confirm:', p.url());
  } else {
    console.log('\n  ❌ Lien non trouvé. Attente supplémentaire 10s...');
    // Supabase peut mettre quelques secondes
    const yop2 = await ctx.newPage();
    await yop2.goto('https://yopmail.com/?'+USER, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await yop2.waitForTimeout(2000);
    await dismissConsent(yop2);
    await yop2.waitForTimeout(10000);
    await yop2.screenshot({ path: 'scripts/v3-yopmail-retry.png' });
    for (const frame of yop2.frames()) {
      try {
        const links = await frame.$$('a[href]');
        for (const link of links) {
          const href = await link.getAttribute('href');
          if (href && (href.includes('supabase') || href.includes('confirm') || href.includes('verify'))) {
            confirmUrl = href;
            break;
          }
        }
        if (!confirmUrl) {
          const text = await frame.textContent('body');
          const match = text.match(/https:\/\/[^\s"<>]+confirm[^\s"<>]*/);
          if (match) confirmUrl = match[0];
        }
        if (confirmUrl) break;
      } catch {}
    }
    await yop2.close();

    if (confirmUrl) {
      console.log('  Lien trouvé (retry) ✅:', confirmUrl.substring(0, 80));
      await p.goto(confirmUrl, { waitUntil: 'networkidle' });
      await p.waitForTimeout(3000);
      await p.screenshot({ path: 'scripts/v3-confirmed.png' });
      console.log('  URL après confirm:', p.url());
    } else {
      console.log('  ❌ Impossible récupérer lien. Email Supabase probablement bloqué.');
    }
  }

  // ── 3. Login ───────────────────────────────────────────────────────────────
  console.log('\n4. Test login...');
  await p.goto('https://alkamar-info.vercel.app/connexion.html', { waitUntil: 'networkidle' });
  await p.fill('#email', TEST_EMAIL);
  await p.fill('#password', TEST_PASS);
  await p.click('#login-btn');
  await p.waitForTimeout(4000);
  await p.screenshot({ path: 'scripts/v3-login.png' });

  const urlLogin = p.url();
  const loginErr = await p.$('#auth-error');
  const loginErrText = loginErr && await loginErr.isVisible() ? await loginErr.textContent() : '';
  console.log('  URL:', urlLogin);
  console.log('  Login:', urlLogin.includes('compte') || urlLogin.includes('index') ? '✅' : '❌ ' + loginErrText);

  await b.close();
  console.log('\n══ DONE ══');
})();
