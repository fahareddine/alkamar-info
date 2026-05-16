// tests/playwright/hero-contact-info-icons.spec.js
// Valide les icônes SVG et infos contact améliorées du slide 7

const { test, expect } = require('@playwright/test');
const BASE = 'https://boutique.info-experts.fr';

const VIEWPORTS = [
  { name: 'mobile-360',   w: 360,  h: 740  },
  { name: 'mobile-390',   w: 390,  h: 844  },
  { name: 'tablet-768',   w: 768,  h: 1024 },
  { name: 'desktop-1366', w: 1366, h: 768  },
  { name: 'desktop-1440', w: 1440, h: 900  },
];

async function goToContact(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => heroSlider.goTo(6));
  await page.waitForTimeout(600);
  return { page, ctx, errors };
}

// ── Infos contact visibles par viewport ──────────────────────────────────
for (const vp of VIEWPORTS) {
  test(`Contact icônes — ${vp.name}`, async ({ browser }) => {
    const { page, ctx, errors } = await goToContact(browser, vp);

    // 0 erreur JS critique
    const critical = errors.filter(e => !e.includes('supabase') && !e.includes('ResizeObserver'));
    expect(critical).toHaveLength(0);

    // Slide 7 actif
    await expect(page.locator('.hero-slide--7')).toHaveClass(/is-active/);

    // Contacts container présent et visible dans le DOM
    const contacts = page.locator('.hcs-contacts');
    await expect(contacts).toBeAttached();

    // Icônes SVG présentes (au moins 3)
    const icons = page.locator('.hero-slide--7 .hcs-ico');
    const iconCount = await icons.count();
    expect(iconCount).toBeGreaterThanOrEqual(3);

    // Vérifier que les SVG sont bien dans les icônes
    const svgCount = await page.locator('.hero-slide--7 .hcs-ico svg').count();
    expect(svgCount).toBeGreaterThanOrEqual(3);

    // Taille lisible — desktop/tablet uniquement
    if (vp.w >= 768) {
      const phoneLink = page.locator('.hero-slide--7 .hcs-cl').first();
      await expect(phoneLink).toBeVisible();
      const fontSize = await phoneLink.evaluate(el => parseFloat(window.getComputedStyle(el).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(11); // min 11px
    }

    // Formulaire toujours visible sur 481px+
    if (vp.w >= 481) {
      await expect(page.locator('#hcs-form')).toBeVisible();
      await expect(page.locator('#hcs-btn')).toBeVisible();
    }

    // Pas de débordement horizontal
    const sw = await page.evaluate(() => document.body.scrollWidth);
    expect(sw).toBeLessThanOrEqual(vp.w + 5);

    await page.screenshot({
      path: `tests/playwright/screenshots/contact-icons-${vp.name}.png`,
      fullPage: false,
    });
    await ctx.close();
  });
}

// ── Icône phone lien tel ─────────────────────────────────────────────────
test('Contact — lien téléphone correct', async ({ browser }) => {
  const { page, ctx } = await goToContact(browser, { w: 1440, h: 900 });
  const tel = page.locator('.hero-slide--7 a[href*="tel:"]');
  await expect(tel).toBeVisible();
  const href = await tel.getAttribute('href');
  expect(href).toContain('+269');
  await ctx.close();
});

// ── Icône WhatsApp lien ──────────────────────────────────────────────────
test('Contact — lien WhatsApp correct', async ({ browser }) => {
  const { page, ctx } = await goToContact(browser, { w: 1440, h: 900 });
  const wa = page.locator('.hero-slide--7 a[href*="wa.me"]');
  await expect(wa).toBeVisible();
  const href = await wa.getAttribute('href');
  expect(href).toContain('wa.me');
  await ctx.close();
});

// ── Email présent ────────────────────────────────────────────────────────
test('Contact — email présent', async ({ browser }) => {
  const { page, ctx } = await goToContact(browser, { w: 1440, h: 900 });
  const email = page.locator('.hero-slide--7 a[href*="mailto"]');
  await expect(email).toBeVisible();
  const href = await email.getAttribute('href');
  expect(href).toContain('info-experts.fr');
  await ctx.close();
});

// ── Slider pause sur focus textarea ─────────────────────────────────────
test('Contact — slider pause quand focus textarea', async ({ browser }) => {
  const { page, ctx } = await goToContact(browser, { w: 1440, h: 900 });

  // Récupérer le slide actif avant focus
  const beforeActive = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-active'))
  );
  expect(beforeActive).toBe(6); // Slide 7 (index 6)

  // Focus sur le textarea
  await page.focus('#hcs-msg');
  await page.waitForTimeout(5000); // Attendre 5s (DELAY=4000ms)

  // Le slide doit toujours être 7 (slider pausé)
  const afterActive = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-active'))
  );
  expect(afterActive).toBe(6); // Toujours slide 7

  await page.screenshot({
    path: 'tests/playwright/screenshots/contact-form-focus-msg.png',
    fullPage: false,
  });
  await ctx.close();
});

// ── Formulaire rempli screenshot ─────────────────────────────────────────
test('Contact — formulaire rempli screenshot', async ({ browser }) => {
  const { page, ctx } = await goToContact(browser, { w: 1440, h: 900 });
  await page.waitForSelector('#hcs-btn', { state: 'visible', timeout: 5000 });
  await page.fill('#hcs-nom', 'Test Playwright');
  await page.fill('#hcs-email', 'test@example.com');
  await page.fill('#hcs-msg', 'Message test formulaire contact hero.');
  await page.screenshot({
    path: 'tests/playwright/screenshots/contact-icons-form-filled.png',
    fullPage: false,
  });
  await ctx.close();
});

// ── Autres slides inchangés ──────────────────────────────────────────────
test('Slides 1-6 — inchangés après amélioration icônes', async ({ browser }) => {
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
  await page.screenshot({ path: 'tests/playwright/screenshots/contact-icons-autres-slides.png' });
  await ctx.close();
});
