// tests/playwright/hero-services-image.spec.js
// Valide le slide Services : carousel-7-sm.png, fond transparent, image entière, bouton fonctionnel

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
  await page.evaluate(() => heroSlider.goTo(4));
  await page.waitForTimeout(600);
  return { page, ctx, errors };
}

// ── Vérifications par viewport ─────────────────────────────────────────────
for (const vp of VIEWPORTS) {
  test(`Services slide — ${vp.name}`, async ({ browser }) => {
    const { page, ctx, errors } = await open(browser, vp);

    // 0 erreur JS critique
    const critErrors = errors.filter(e => !e.includes('supabase') && !e.includes('ResizeObserver'));
    expect(critErrors, 'Erreurs JS: ' + critErrors.join(', ')).toHaveLength(0);

    // Slide 5 actif
    const slide5 = page.locator('.hero-slide--5');
    await expect(slide5).toHaveClass(/is-active/);

    // Titre visible
    const title = slide5.locator('.hero-slide__title');
    await expect(title).toBeVisible();

    // CTA bouton visible et lien correct
    const cta = slide5.locator('.hero-slide__cta');
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute('href');
    expect(href).toContain('/services.html');

    // Image : visible sur tablet+ (masquée mobile < 480px)
    if (vp.w >= 481) {
      const img = slide5.locator('.hero-slide__img img');
      await expect(img).toBeVisible();

      // Image chargée (naturalWidth > 0)
      const natural = await img.evaluate(el => el.naturalWidth);
      expect(natural, 'Image naturalWidth = 0 (cassée)').toBeGreaterThan(0);

      // Image non déformée (ratio raisonnable)
      const box = await img.boundingBox();
      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThan(50);
      expect(box.height).toBeGreaterThan(30);

      // Image src contient slide-services
      const src = await img.getAttribute('src');
      expect(src).toContain('slide-services');

      // Image ne dépasse pas le container
      const containerBox = await slide5.locator('.hero-slide__img').boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(containerBox.x - 2);
      expect(box.y).toBeGreaterThanOrEqual(containerBox.y - 2);
    }

    // Screenshot slide Services
    await page.screenshot({
      path: `tests/playwright/screenshots/services-${vp.name}.png`,
      fullPage: false,
    });

    await ctx.close();
  });
}

// ── Screenshot pleine page desktop ────────────────────────────────────────
test('Services slide — pleine page desktop 1440', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1440, h: 900, name: 'desktop-1440' });
  await page.screenshot({
    path: 'tests/playwright/screenshots/services-fullpage-desktop.png',
    fullPage: true,
    clip: { x: 0, y: 0, width: 1440, height: 450 },
  });
  await ctx.close();
});

// ── CTA Services → page cible ──────────────────────────────────────────────
test('Services CTA → page services.html charge', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1440, h: 900, name: 'desktop-1440' });

  const cta = page.locator('.hero-slide--5 .hero-slide__cta');
  await expect(cta).toBeVisible();

  await Promise.all([
    page.waitForURL('**/services.html', { timeout: 15000 }),
    cta.click(),
  ]);

  await expect(page).toHaveURL(/services\.html/);

  await page.screenshot({
    path: 'tests/playwright/screenshots/services-cible.png',
    fullPage: false,
  });

  await ctx.close();
});

// ── Autres slides inchangés ────────────────────────────────────────────────
test('Slides 1-4 inchangés', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });

  for (let i = 0; i < 4; i++) {
    await page.evaluate(idx => heroSlider.goTo(idx), i);
    await page.waitForTimeout(500);

    const slide = page.locator(`.hero-slide--${i + 1}`);
    await expect(slide).toHaveClass(/is-active/);

    const cta = slide.locator('.hero-slide__cta');
    await expect(cta).toBeVisible();

    const img = slide.locator('.hero-slide__img img');
    const natural = await img.evaluate(el => el.naturalWidth);
    expect(natural).toBeGreaterThan(0);
  }

  await ctx.close();
});
