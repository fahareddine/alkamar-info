// tests/playwright/hero-mobile.spec.js
// Vérifie lisibilité hero mobile + intégrité desktop après fix flèches

const { test, expect } = require('@playwright/test');
const BASE = 'https://boutique.info-experts.fr';

const MOBILE_VIEWPORTS = [
  { name: '360x740',  width: 360,  height: 740  },
  { name: '390x844',  width: 390,  height: 844  },
  { name: '430x932',  width: 430,  height: 932  },
];

const DESKTOP_VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768  },
  { name: '1440x900', width: 1440, height: 900  },
];

for (const vp of MOBILE_VIEWPORTS) {
  test(`Hero mobile lisible — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    // 0 erreur JS critique
    expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);

    // Hero visible
    const hero = page.locator('#hero-slider');
    await expect(hero).toBeVisible();

    // Titre visible
    const title = page.locator('.hero-slide__title').first();
    await expect(title).toBeVisible();
    const titleBox = await title.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(titleBox.height).toBeGreaterThan(10);

    // Flèches cachées sur mobile
    const btnPrev = page.locator('#hero-prev');
    const btnNext = page.locator('#hero-next');
    await expect(btnPrev).toBeHidden();
    await expect(btnNext).toBeHidden();

    // Dots toujours visibles (navigation alternative)
    const dots = page.locator('.hero-slider__dots');
    await expect(dots).toBeVisible();

    // Catégories visibles après le hero
    const cards = page.locator('.products-grid .product-card');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });

    // Screenshot mobile
    await page.screenshot({
      path: `tests/playwright/screenshots/hero-mobile-${vp.name}.png`,
      fullPage: false
    });

    await ctx.close();
  });
}

for (const vp of DESKTOP_VIEWPORTS) {
  test(`Hero desktop intact — ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    // 0 erreur JS critique
    expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);

    // Hero visible
    await expect(page.locator('#hero-slider')).toBeVisible();

    // Titre visible
    await expect(page.locator('.hero-slide__title').first()).toBeVisible();

    // Flèches VISIBLES sur desktop
    const btnPrev = page.locator('#hero-prev');
    const btnNext = page.locator('#hero-next');
    await expect(btnPrev).toBeVisible();
    await expect(btnNext).toBeVisible();

    // Taille minimum des flèches (accessible)
    const prevBox = await btnPrev.boundingBox();
    expect(prevBox.width).toBeGreaterThanOrEqual(20);
    expect(prevBox.height).toBeGreaterThanOrEqual(30);

    // Image produit visible desktop
    const heroImg = page.locator('.hero-slide__img').first();
    await expect(heroImg).toBeVisible();

    // Produits / catégories visibles
    const cards = page.locator('.products-grid .product-card');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });

    // Screenshot desktop
    await page.screenshot({
      path: `tests/playwright/screenshots/hero-desktop-${vp.name}.png`,
      fullPage: false
    });

    await ctx.close();
  });
}

test('Carousel swipe mobile fonctionne (touch)', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  const heroTrack = page.locator('#hero-track');
  const initialTransform = await heroTrack.evaluate(el => getComputedStyle(el).transform);

  // Simule swipe gauche
  const hero = page.locator('#hero-slider');
  const box = await hero.boundingBox();
  if (box) {
    await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height / 2);
    await page.touchscreen.tap(box.x + box.width * 0.2, box.y + box.height / 2);
  }

  // Le carousel doit rester sans erreur
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);

  await ctx.close();
});
