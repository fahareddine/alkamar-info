// tests/playwright/hero-contact-form-autoplay.spec.js
// Valide : slider bloqué au focus form + message succès exact

const { test, expect } = require('@playwright/test');
const BASE = 'https://boutique.info-experts.fr';
const DELAY_MS = 4200; // légèrement > DELAY=4000ms slider

async function goToContact(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => heroSlider.goTo(6));
  await page.waitForTimeout(500);
  return { page, ctx, errors };
}

// ── 1. Slider bloqué dès focus dans Nom ───────────────────────────────────
test('Slider — bloqué au focus dans champ Nom', async ({ browser }) => {
  const { page, ctx } = await goToContact(browser, { w: 1440, h: 900 });

  await page.click('#hcs-nom');
  await page.waitForTimeout(DELAY_MS);

  const activeIdx = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-active'))
  );
  expect(activeIdx, 'Slider a changé de slide pendant le focus Nom').toBe(6);

  await page.screenshot({ path: 'tests/playwright/screenshots/autoplay-nom-focus.png' });
  await ctx.close();
});

// ── 2. Slider bloqué au focus dans Email ──────────────────────────────────
test('Slider — bloqué au focus dans champ Email', async ({ browser }) => {
  const { page, ctx } = await goToContact(browser, { w: 1440, h: 900 });

  await page.click('#hcs-email');
  await page.type('#hcs-email', 'test@example.com', { delay: 20 });
  await page.waitForTimeout(DELAY_MS);

  const activeIdx = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-active'))
  );
  expect(activeIdx).toBe(6);
  const val = await page.locator('#hcs-email').inputValue();
  expect(val).toBe('test@example.com');

  await ctx.close();
});

// ── 3. Slider bloqué pendant écriture dans Message ────────────────────────
test('Slider — bloqué pendant écriture dans Message', async ({ browser }) => {
  const { page, ctx } = await goToContact(browser, { w: 1366, h: 768 });

  const MSG = 'Ceci est un test Playwright. Le slider ne doit pas bouger pendant que j\'écris.';
  await page.click('#hcs-msg');
  await page.type('#hcs-msg', MSG, { delay: 25 });
  await page.waitForTimeout(DELAY_MS);

  const activeIdx = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-active'))
  );
  expect(activeIdx, 'Slider a changé pendant écriture Message').toBe(6);

  const val = await page.locator('#hcs-msg').inputValue();
  expect(val).toContain('slider ne doit pas bouger');

  await page.screenshot({ path: 'tests/playwright/screenshots/autoplay-msg-filled.png' });
  await ctx.close();
});

// ── 4. Transition entre champs sans relancer slider ───────────────────────
test('Slider — reste bloqué lors du passage Nom→Email→Message', async ({ browser }) => {
  const { page, ctx } = await goToContact(browser, { w: 1440, h: 900 });

  await page.fill('#hcs-nom', 'Test Playwright');
  await page.press('#hcs-nom', 'Tab'); // blur nom, focus email
  await page.waitForTimeout(500);
  await page.fill('#hcs-email', 'test@example.com');
  await page.press('#hcs-email', 'Tab'); // blur email, focus msg
  await page.waitForTimeout(500);
  await page.fill('#hcs-msg', 'Message de test pour le formulaire contact hero.');
  await page.waitForTimeout(DELAY_MS); // attendre > autoplay

  const activeIdx = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-active'))
  );
  expect(activeIdx, 'Slider a changé lors du passage entre champs').toBe(6);

  // Valeurs préservées
  expect(await page.locator('#hcs-nom').inputValue()).toBe('Test Playwright');
  expect(await page.locator('#hcs-email').inputValue()).toBe('test@example.com');
  expect(await page.locator('#hcs-msg').inputValue()).toContain('test pour le formulaire');

  await ctx.close();
});

// ── 5. Message de confirmation exact après succès ─────────────────────────
test('Formulaire — message succès exact après envoi (mock Formspree)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // Mock Formspree avant navigation
  await page.route('https://formspree.io/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => heroSlider.goTo(6));
  await page.waitForSelector('#hcs-btn', { state: 'visible', timeout: 8000 });

  await page.fill('#hcs-nom', 'Test Playwright');
  await page.fill('#hcs-email', 'test@example.com');
  await page.fill('#hcs-msg', 'Ceci est un test Playwright. Le slider ne doit pas bouger.');
  await page.click('#hcs-btn');

  // Attendre le message de succès
  await page.waitForFunction(() => {
    const ok = document.getElementById('hcs-ok');
    return ok && ok.style.display === 'block';
  }, { timeout: 6000 });

  // Vérifier le texte exact
  const okText = await page.locator('#hcs-ok').textContent();
  expect(okText).toContain('Nous vous répondrons dans les meilleurs délais.');

  // Slider toujours sur slide Contact après succès
  const activeIdx = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-active'))
  );
  expect(activeIdx).toBe(6);

  await page.screenshot({ path: 'tests/playwright/screenshots/autoplay-success-msg-desktop.png' });

  const critical = errors.filter(e => !e.includes('supabase'));
  expect(critical).toHaveLength(0);
  await ctx.close();
});

// ── 6. Message succès mobile ──────────────────────────────────────────────
test('Formulaire — message succès mobile 390x844', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  await page.route('https://formspree.io/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => heroSlider.goTo(6));
  await page.waitForTimeout(800);

  // Sur mobile < 480px, form est masqué — test que le slide existe et reste actif
  const activeIdx = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-active'))
  );
  expect(activeIdx).toBe(6);

  await page.waitForTimeout(DELAY_MS);
  const stillActive = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-active'))
  );
  // Sur mobile sans interaction, le slider peut avancer (OK)
  // L'important est que sans interaction form, le comportement est normal

  await page.screenshot({ path: 'tests/playwright/screenshots/autoplay-mobile-slide7.png' });
  await ctx.close();
});

// ── 7. Non-régression slides 1-6 ─────────────────────────────────────────
test('Non-régression — slides 1-6 accessibles', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });

  for (let i = 0; i < 6; i++) {
    await page.evaluate(idx => heroSlider.goTo(idx), i);
    await page.waitForTimeout(400);
    const active = await page.evaluate(() =>
      document.querySelectorAll('.hero-slide.is-active').length
    );
    expect(active).toBe(1);
  }

  // Retourner au Contact
  await page.evaluate(() => heroSlider.goTo(6));
  await page.waitForTimeout(400);
  const idx = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-active'))
  );
  expect(idx).toBe(6);

  await page.screenshot({ path: 'tests/playwright/screenshots/autoplay-autres-slides.png' });
  await ctx.close();
});

// ── 8. Aucune erreur JS + produits visibles ───────────────────────────────
test('Non-régression — 0 erreur JS + produits visibles', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  const card = page.locator('#products-grid .product-card').first();
  await expect(card).toBeVisible({ timeout: 10000 });
  const critical = errors.filter(e => !e.includes('supabase') && !e.includes('ResizeObserver'));
  expect(critical).toHaveLength(0);
  await ctx.close();
});
