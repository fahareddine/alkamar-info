// tests/playwright/navigation-scroll-products.spec.js
// Vérifie que clic onglet/catégorie affiche les produits directement

const { test, expect } = require('@playwright/test');
const BASE = 'https://boutique.info-experts.fr';

const DESKTOP = { width: 1366, height: 768 };
const MOBILE  = { width: 390,  height: 844 };

async function openAt(browser, vp, url) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  return { page, ctx, errors };
}

async function checkProductsVisible(page, gridId) {
  return page.evaluate(async (gid) => {
    await new Promise(r => setTimeout(r, 700));
    const grid = document.getElementById(gid);
    const header = document.querySelector('.header');
    const headerH = header?.getBoundingClientRect().height || 64;
    const gridTop = grid ? grid.getBoundingClientRect().top : null;
    return {
      scrollY: Math.round(window.scrollY),
      gridTop: Math.round(gridTop),
      gridVisible: gridTop !== null && gridTop < window.innerHeight,
      headerH: Math.round(headerH),
      headerCoversGrid: gridTop < headerH,
      products: grid?.querySelectorAll('.product-card').length || 0
    };
  }, gridId);
}

test.describe('Navigation scroll — produits visibles après clic onglet', () => {

  test('desktop — clic "Cartes mères" → produits visibles', async ({ browser }) => {
    const { page, ctx, errors } = await openAt(browser, DESKTOP, '/composants.html');

    const btn = page.locator('.cat-tab', { hasText: 'Cartes mères' });
    await btn.click();

    const m = await checkProductsVisible(page, 'grid-cartemere');
    expect(m.gridVisible).toBe(true);
    expect(m.headerCoversGrid).toBe(false);
    expect(m.products).toBeGreaterThan(0);
    expect(m.scrollY).toBeGreaterThan(0); // a scrollé vers les produits
    expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);

    await page.screenshot({ path: 'tests/playwright/screenshots/scroll-cartemere-desktop.png' });
    await ctx.close();
  });

  test('desktop — clic "Processeurs CPU" → produits visibles', async ({ browser }) => {
    const { page, ctx, errors } = await openAt(browser, DESKTOP, '/composants.html');

    const btn = page.locator('.cat-tab', { hasText: 'Processeurs' });
    await btn.click();

    const m = await checkProductsVisible(page, 'grid-cpu');
    expect(m.gridVisible).toBe(true);
    expect(m.products).toBeGreaterThan(0);

    await page.screenshot({ path: 'tests/playwright/screenshots/scroll-cpu-desktop.png' });
    await ctx.close();
  });

  test('desktop — URL ?tab=cartemere → scroll automatique', async ({ browser }) => {
    const { page, ctx, errors } = await openAt(browser, DESKTOP, '/composants.html?tab=cartemere');
    await page.waitForTimeout(600);

    const m = await checkProductsVisible(page, 'grid-cartemere');
    expect(m.gridVisible).toBe(true);
    expect(m.scrollY).toBeGreaterThan(0);
    expect(m.products).toBeGreaterThan(0);

    await page.screenshot({ path: 'tests/playwright/screenshots/scroll-url-tab-desktop.png' });
    await ctx.close();
  });

  test('desktop — clic Composants (page ordinateurs) → produits visibles', async ({ browser }) => {
    const { page, ctx, errors } = await openAt(browser, DESKTOP, '/ordinateurs.html');

    const btn = page.locator('.cat-tab', { hasText: 'PC Portables' });
    await btn.click();

    const m = await checkProductsVisible(page, 'grid-portables');
    expect(m.gridVisible).toBe(true);

    await page.screenshot({ path: 'tests/playwright/screenshots/scroll-portables-desktop.png' });
    await ctx.close();
  });

  test('mobile 390px — URL ?tab=cartemere → produits visibles', async ({ browser }) => {
    const { page, ctx, errors } = await openAt(browser, MOBILE, '/composants.html?tab=cartemere');
    await page.waitForTimeout(600);

    const m = await checkProductsVisible(page, 'grid-cartemere');
    expect(m.gridVisible).toBe(true);
    expect(m.headerCoversGrid).toBe(false);
    expect(m.products).toBeGreaterThan(0);
    expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);

    await page.screenshot({ path: 'tests/playwright/screenshots/scroll-cartemere-mobile.png' });
    await ctx.close();
  });

  test('mobile 390px — clic onglet "RAM / Mémoire" → produits visibles', async ({ browser }) => {
    const { page, ctx, errors } = await openAt(browser, MOBILE, '/composants.html');

    const btn = page.locator('.cat-tab', { hasText: 'RAM' });
    await btn.click();

    const m = await checkProductsVisible(page, 'grid-ram');
    expect(m.gridVisible).toBe(true);
    expect(m.products).toBeGreaterThan(0);

    await page.screenshot({ path: 'tests/playwright/screenshots/scroll-ram-mobile.png' });
    await ctx.close();
  });

  test('desktop — page réseau clic onglet → produits visibles', async ({ browser }) => {
    const { page, ctx } = await openAt(browser, DESKTOP, '/reseau.html');

    const btn = page.locator('.cat-tab', { hasText: 'Switches' });
    await btn.click();

    const m = await checkProductsVisible(page, 'grid-switch');
    expect(m.gridVisible).toBe(true);

    await ctx.close();
  });

  test('aucune erreur JS sur composants + ordinateurs + réseau', async ({ browser }) => {
    for (const url of ['/composants.html', '/ordinateurs.html', '/reseau.html', '/stockage.html']) {
      const { page, ctx, errors } = await openAt(browser, DESKTOP, url);
      await page.waitForTimeout(500);
      expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);
      await ctx.close();
    }
  });
});
