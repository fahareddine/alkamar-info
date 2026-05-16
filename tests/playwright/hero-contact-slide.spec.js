// tests/playwright/hero-contact-slide.spec.js
// Valide le slide 7 Contact : formulaire Formspree, validation, 7 dots

const { test, expect } = require('@playwright/test');
const BASE = 'https://boutique.info-experts.fr';

const VIEWPORTS = [
  { name: 'mobile-360',   w: 360,  h: 740  },
  { name: 'mobile-390',   w: 390,  h: 844  },
  { name: 'mobile-430',   w: 430,  h: 932  },
  { name: 'tablet-768',   w: 768,  h: 1024 },
  { name: 'desktop-1366', w: 1366, h: 768  },
  { name: 'desktop-1440', w: 1440, h: 900  },
];

async function open(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => heroSlider.goTo(6));
  await page.waitForTimeout(600);
  return { page, ctx, errors };
}

// ── Tests par viewport ─────────────────────────────────────────────────────
for (const vp of VIEWPORTS) {
  test(`Contact slide — ${vp.name}`, async ({ browser }) => {
    const { page, ctx, errors } = await open(browser, vp);

    // 0 erreur JS critique
    const critical = errors.filter(e => !e.includes('supabase') && !e.includes('ResizeObserver'));
    expect(critical, `Erreurs JS: ${critical.join(', ')}`).toHaveLength(0);

    // Slide 7 actif
    const slide7 = page.locator('.hero-slide--7');
    await expect(slide7).toHaveClass(/is-active/);

    // Titre visible
    await expect(slide7.locator('.hero-slide__title')).toBeVisible();

    // Un seul slide actif
    const activeCount = await page.evaluate(() =>
      document.querySelectorAll('.hero-slide.is-active').length
    );
    expect(activeCount, 'Superposition slides').toBe(1);

    // Formulaire visible sur tablet+
    if (vp.w >= 481) {
      const form = slide7.locator('#hcs-form');
      await expect(form).toBeVisible();
      const nom = slide7.locator('#hcs-nom');
      await expect(nom).toBeVisible();
      const email = slide7.locator('#hcs-email');
      await expect(email).toBeVisible();
      const msg = slide7.locator('#hcs-msg');
      await expect(msg).toBeVisible();
      const btn = slide7.locator('#hcs-btn');
      await expect(btn).toBeVisible();
    }

    await page.screenshot({
      path: `tests/playwright/screenshots/contact-${vp.name}.png`,
      fullPage: false,
    });
    await ctx.close();
  });
}

// ── Validation formulaire — champs vides ──────────────────────────────────
test('Contact — validation champ vide nom', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1440, h: 900 });

  // Soumettre sans remplir
  await page.locator('#hcs-btn').click();
  await page.waitForTimeout(300);

  // Erreur visible (nom trop court)
  const err = page.locator('#hcs-err');
  const errDisplay = await err.evaluate(el => el.style.display);
  expect(errDisplay).toBe('block');

  await ctx.close();
});

// ── Validation formulaire — email invalide ─────────────────────────────────
test('Contact — validation email invalide', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1440, h: 900 });

  await page.fill('#hcs-nom', 'Test User');
  await page.fill('#hcs-email', 'not-an-email');
  await page.fill('#hcs-msg', 'Test message valide pour Playwright');
  await page.locator('#hcs-btn').click();
  await page.waitForTimeout(300);

  const err = page.locator('#hcs-err');
  const errDisplay = await err.evaluate(el => el.style.display);
  expect(errDisplay).toBe('block');

  await ctx.close();
});

// ── Formulaire rempli screenshot ──────────────────────────────────────────
test('Contact — formulaire rempli et soumis (mock Formspree)', async ({ browser }) => {
  // Mock avant navigation pour intercepter la requête Formspree
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // Intercepter Formspree AVANT navigation
  await page.route('https://formspree.io/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => heroSlider.goTo(6));
  await page.waitForSelector('#hcs-btn', { state: 'visible', timeout: 8000 });

  // Remplir le formulaire
  await page.fill('#hcs-nom', 'Test Playwright');
  await page.fill('#hcs-email', 'test@example.com');
  await page.fill('#hcs-msg', 'Ceci est un test automatisé du formulaire de contact du hero.');

  await page.screenshot({
    path: 'tests/playwright/screenshots/contact-form-filled-desktop.png',
    fullPage: false,
  });

  await page.locator('#hcs-btn').click();
  // Attendre que la réponse soit traitée
  await page.waitForFunction(() => {
    const ok = document.getElementById('hcs-ok');
    return ok && ok.style.display === 'block';
  }, { timeout: 5000 });

  await page.screenshot({
    path: 'tests/playwright/screenshots/contact-form-success-desktop.png',
    fullPage: false,
  });

  const critical = errors.filter(e => !e.includes('supabase'));
  expect(critical).toHaveLength(0);
  await ctx.close();
});

// ── 7 dots présents ────────────────────────────────────────────────────────
test('Hero — 7 dots présents', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  const dots = await page.locator('.hero-dot').count();
  expect(dots).toBe(7);
  await ctx.close();
});

// ── Slides 1-6 inchangés ───────────────────────────────────────────────────
test('Slides 1-6 — inchangés après ajout slide 7', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });

  for (let i = 0; i < 6; i++) {
    await page.evaluate(idx => heroSlider.goTo(idx), i);
    await page.waitForTimeout(400);
    const active = await page.evaluate(() =>
      document.querySelectorAll('.hero-slide.is-active').length
    );
    expect(active, `Slide ${i+1}: superposition`).toBe(1);
  }
  await page.screenshot({ path: 'tests/playwright/screenshots/contact-autres-slides-ok.png' });
  await ctx.close();
});

// ── Contact info visible ──────────────────────────────────────────────────
test('Contact — infos téléphone/WhatsApp visibles', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1366, h: 768 });
  const phone = page.locator('.hero-slide--7 a[href*="tel"]');
  await expect(phone).toBeVisible();
  const wa = page.locator('.hero-slide--7 a[href*="wa.me"]');
  await expect(wa).toBeVisible();
  await ctx.close();
});

// ── Pas de scroll horizontal ───────────────────────────────────────────────
test('Contact slide mobile — pas de débordement horizontal', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 390, h: 844 });
  const sw = await page.evaluate(() => document.body.scrollWidth);
  expect(sw).toBeLessThanOrEqual(395);
  await ctx.close();
});
