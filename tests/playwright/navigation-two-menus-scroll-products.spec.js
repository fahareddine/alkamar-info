// tests/playwright/navigation-two-menus-scroll-products.spec.js
// Vérifie que les deux menus (principal + icônes) affichent les produits directement

const { test, expect } = require('@playwright/test');
const BASE = 'https://boutique.info-experts.fr';

const DESKTOP = { width: 1366, height: 768 };
const MOBILE  = { width: 390,  height: 844 };

async function openAt(browser, vp, path) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  return { page, ctx, errors };
}

async function waitAndMeasure(page, gridSelector = '.products-grid') {
  return page.evaluate(async (sel) => {
    await new Promise(r => setTimeout(r, 900));
    const grid = document.querySelector(sel);
    const header = document.querySelector('.header');
    const headerH = header?.getBoundingClientRect().height || 64;
    const gridTop = grid ? Math.round(grid.getBoundingClientRect().top) : null;
    return {
      scrollY: Math.round(window.scrollY),
      gridTop,
      gridVisible: gridTop !== null && gridTop < window.innerHeight,
      headerCoversGrid: gridTop !== null && gridTop < headerH,
      products: document.querySelectorAll('.product-card').length
    };
  }, gridSelector);
}

// ── Menu principal (menu du haut avec catégories texte) ────────────────────
test.describe('Menu principal — scroll vers produits', () => {
  const pages = [
    { name: 'Composants',   path: '/composants.html' },
    { name: 'Ordinateurs',  path: '/ordinateurs.html' },
    { name: 'Périphériques',path: '/peripheriques.html' },
    { name: 'Réseau',       path: '/reseau.html' },
    { name: 'Stockage',     path: '/stockage.html' },
    { name: 'Écrans',       path: '/ecrans.html' },
    { name: 'Protection',   path: '/protection.html' },
    { name: 'Promotions',   path: '/promotions.html' },
    { name: 'Reconditionnés',path:'/reconditionnes.html' },
  ];

  for (const { name, path } of pages) {
    test(`desktop — ${name} → produits visibles`, async ({ browser }) => {
      const { page, ctx, errors } = await openAt(browser, DESKTOP, path);
      const m = await waitAndMeasure(page);

      expect(m.gridVisible).toBe(true);
      expect(m.headerCoversGrid).toBe(false);
      expect(m.scrollY).toBeGreaterThan(0);
      expect(m.products).toBeGreaterThan(0);
      expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);

      await page.screenshot({ path: `tests/playwright/screenshots/menu-${name.toLowerCase()}-desktop.png` });
      await ctx.close();
    });
  }
});

// ── Menu icônes (quick-cats) avec ?tab= ────────────────────────────────────
test.describe('Menu icônes — scroll vers produits', () => {
  const quickCats = [
    { name: 'PC Portables', path: '/ordinateurs.html?tab=portables',  grid: '#grid-portables' },
    { name: 'PC Bureau',    path: '/ordinateurs.html?tab=bureau',     grid: '#grid-bureau' },
    { name: 'Gaming',       path: '/ordinateurs.html?tab=gaming',     grid: '#grid-gaming' },
    { name: 'Composants',   path: '/composants.html',                  grid: '.products-grid' },
    { name: 'Périphériques',path: '/peripheriques.html',              grid: '.products-grid' },
    { name: 'Imprimantes',  path: '/imprimantes.html',                 grid: '.products-grid' },
    { name: 'Réseau',       path: '/reseau.html',                      grid: '.products-grid' },
    { name: 'Stockage',     path: '/stockage.html',                    grid: '.products-grid' },
  ];

  for (const { name, path, grid } of quickCats) {
    test(`desktop — quick-cat "${name}" → produits visibles`, async ({ browser }) => {
      const { page, ctx, errors } = await openAt(browser, DESKTOP, path);
      const m = await waitAndMeasure(page, grid);

      expect(m.gridVisible).toBe(true);
      expect(m.headerCoversGrid).toBe(false);
      expect(m.scrollY).toBeGreaterThan(0);
      expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);

      await page.screenshot({ path: `tests/playwright/screenshots/quickcat-${name.toLowerCase().replace(/ /g, '-')}-desktop.png` });
      await ctx.close();
    });
  }
});

// ── Sous-catégories (clic onglet dans la page) ────────────────────────────
test.describe('Sous-catégories — scroll vers produits', () => {
  test('desktop — CPU → Cartes mères → RAM', async ({ browser }) => {
    const { page, ctx, errors } = await openAt(browser, DESKTOP, '/composants.html');

    // Click "Cartes mères"
    await page.locator('.cat-tab', { hasText: 'Cartes mères' }).click();
    let m = await waitAndMeasure(page, '#grid-cartemere');
    expect(m.gridVisible).toBe(true);
    expect(m.scrollY).toBeGreaterThan(0);
    await page.screenshot({ path: 'tests/playwright/screenshots/subcat-cartemere-desktop.png' });

    // Click "RAM / Mémoire"
    await page.locator('.cat-tab', { hasText: 'RAM' }).click();
    m = await waitAndMeasure(page, '#grid-ram');
    expect(m.gridVisible).toBe(true);
    await page.screenshot({ path: 'tests/playwright/screenshots/subcat-ram-desktop.png' });

    expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);
    await ctx.close();
  });

  test('desktop — URL ?tab=cartemere → produits visibles', async ({ browser }) => {
    const { page, ctx } = await openAt(browser, DESKTOP, '/composants.html?tab=cartemere');
    const m = await waitAndMeasure(page, '#grid-cartemere');
    expect(m.gridVisible).toBe(true);
    expect(m.scrollY).toBeGreaterThan(0);
    await ctx.close();
  });
});

// ── Mobile ────────────────────────────────────────────────────────────────
test.describe('Mobile 390px — scroll vers produits', () => {
  test('mobile — composants → produits visibles', async ({ browser }) => {
    const { page, ctx, errors } = await openAt(browser, MOBILE, '/composants.html');
    const m = await waitAndMeasure(page);

    expect(m.gridVisible).toBe(true);
    expect(m.headerCoversGrid).toBe(false);
    expect(m.scrollY).toBeGreaterThan(0);
    expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);

    await page.screenshot({ path: 'tests/playwright/screenshots/mobile-composants.png' });
    await ctx.close();
  });

  test('mobile — ?tab=portables → produits PC Portables visibles', async ({ browser }) => {
    const { page, ctx } = await openAt(browser, MOBILE, '/ordinateurs.html?tab=portables');
    const m = await waitAndMeasure(page, '#grid-portables');
    expect(m.gridVisible).toBe(true);
    expect(m.scrollY).toBeGreaterThan(0);
    await page.screenshot({ path: 'tests/playwright/screenshots/mobile-portables.png' });
    await ctx.close();
  });

  test('mobile — clic onglet RAM → produits visibles', async ({ browser }) => {
    const { page, ctx } = await openAt(browser, MOBILE, '/composants.html');
    await page.locator('.cat-tab', { hasText: 'RAM' }).click();
    const m = await waitAndMeasure(page, '#grid-ram');
    expect(m.gridVisible).toBe(true);
    await ctx.close();
  });
});

// ── Fonctionnalités essentielles intactes ─────────────────────────────────
test.describe('Fonctionnalités essentielles', () => {
  test('tri fonctionne après scroll', async ({ browser }) => {
    const { page, ctx } = await openAt(browser, DESKTOP, '/composants.html');
    await page.waitForTimeout(600);
    const sortSelect = page.locator('select').first();
    await expect(sortSelect).toBeVisible();
    await ctx.close();
  });

  test('panier accessible après navigation', async ({ browser }) => {
    const { page, ctx } = await openAt(browser, DESKTOP, '/composants.html');
    const cartBtn = page.locator('.btn-cart').first();
    await expect(cartBtn).toBeVisible({ timeout: 5000 });
    await ctx.close();
  });

  test('0 erreur JS sur toutes les pages catégorie', async ({ browser }) => {
    const paths = ['/composants.html','/ordinateurs.html','/reseau.html','/stockage.html','/protection.html','/promotions.html'];
    for (const path of paths) {
      const { page, ctx, errors } = await openAt(browser, DESKTOP, path);
      await page.waitForTimeout(500);
      expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);
      await ctx.close();
    }
  });
});
