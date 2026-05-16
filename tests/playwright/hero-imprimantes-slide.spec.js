// tests/playwright/hero-imprimantes-slide.spec.js
// Valide le slide 6 Imprimantes : produit Brother, image entière, CTA /imprimantes.html

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
  await page.evaluate(() => heroSlider.goTo(5));
  await page.waitForTimeout(600);
  return { page, ctx, errors };
}

// ── Tests par viewport ─────────────────────────────────────────────────────
for (const vp of VIEWPORTS) {
  test(`Imprimantes slide — ${vp.name}`, async ({ browser }) => {
    const { page, ctx, errors } = await open(browser, vp);

    // 0 erreur JS critique
    const critical = errors.filter(e => !e.includes('supabase') && !e.includes('ResizeObserver'));
    expect(critical, `Erreurs JS: ${critical.join(', ')}`).toHaveLength(0);

    // Slide 6 actif
    const slide6 = page.locator('.hero-slide--6');
    await expect(slide6).toHaveClass(/is-active/);

    // Titre visible
    await expect(slide6.locator('.hero-slide__title')).toBeVisible();

    // CTA visible et correct
    const cta = slide6.locator('.hero-slide__cta');
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute('href');
    expect(href).toContain('/imprimantes.html');

    // Image visible sur tablet+ (masquée < 480px)
    if (vp.w >= 481) {
      const img = slide6.locator('.hero-slide__img img');
      await expect(img).toBeVisible();
      const natural = await img.evaluate(el => el.naturalWidth);
      expect(natural, 'Image cassée (naturalWidth=0)').toBeGreaterThan(0);
      const src = await img.getAttribute('src');
      expect(src).toContain('slide-imprimantes');
    }

    // Un seul slide actif
    const activeCount = await page.evaluate(() =>
      document.querySelectorAll('.hero-slide.is-active').length
    );
    expect(activeCount, 'Superposition de slides').toBe(1);

    await page.screenshot({
      path: `tests/playwright/screenshots/imprimantes-${vp.name}.png`,
      fullPage: false,
    });
    await ctx.close();
  });
}

// ── Image imprimante desktop ───────────────────────────────────────────────
test('Imprimantes — image non coupée desktop 1440', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1440, h: 900 });
  const img = page.locator('.hero-slide--6 .hero-slide__img img');
  await expect(img).toBeVisible();
  const box = await img.boundingBox();
  const container = await page.locator('.hero-slide--6 .hero-slide__img').boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThan(50);
  expect(box.height).toBeGreaterThan(30);
  // image ne dépasse pas son container
  expect(box.x).toBeGreaterThanOrEqual(container.x - 2);
  await ctx.close();
});

// ── CTA → /imprimantes.html charge avec produits ───────────────────────────
test('CTA Imprimantes → page /imprimantes.html charge', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1440, h: 900 });
  const cta = page.locator('.hero-slide--6 .hero-slide__cta');
  await expect(cta).toBeVisible();
  await Promise.all([
    page.waitForURL('**/imprimantes.html**', { timeout: 15000 }),
    cta.click(),
  ]);
  await expect(page).toHaveURL(/imprimantes\.html/);
  // Produits visibles
  await page.waitForTimeout(2000);
  const cards = page.locator('.product-card');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  await page.screenshot({ path: 'tests/playwright/screenshots/imprimantes-page-cible.png' });
  await ctx.close();
});

// ── Slides 1-5 inchangés ──────────────────────────────────────────────────
test('Slides 1-5 — inchangés après ajout slide 6', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });

  for (let i = 0; i < 5; i++) {
    await page.evaluate(idx => heroSlider.goTo(idx), i);
    await page.waitForTimeout(500);
    const active = await page.evaluate(() =>
      document.querySelectorAll('.hero-slide.is-active').length
    );
    expect(active, `Slide ${i+1}: plusieurs actifs`).toBe(1);
    const cta = page.locator(`.hero-slide--${i+1} .hero-slide__cta`);
    await expect(cta).toBeVisible();
  }
  await page.screenshot({ path: 'tests/playwright/screenshots/imprimantes-autres-slides-ok.png' });
  await ctx.close();
});

// ── 6 dots présents ───────────────────────────────────────────────────────
test('Hero — 6 dots présents', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  const dots = await page.locator('.hero-dot').count();
  expect(dots).toBe(6);
  await ctx.close();
});
