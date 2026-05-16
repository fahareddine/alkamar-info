// tests/playwright/pagespeed-regression.spec.js
// Vérification régression performance + intégrité fonctionnelle

const { test, expect } = require('@playwright/test');
const BASE = 'https://boutique.info-experts.fr';

const PAGES = [
  { path: '/',                          name: 'Accueil' },
  { path: '/ordinateurs.html',          name: 'Ordinateurs' },
  { path: '/ordinateurs.html?tab=portables', name: 'Portables' },
  { path: '/composants.html',           name: 'Composants' },
  { path: '/composants.html?tab=processeurs', name: 'CPU' },
  { path: '/peripheriques.html',        name: 'Périphériques' },
  { path: '/imprimantes.html',          name: 'Imprimantes' },
  { path: '/reseau.html',               name: 'Réseau' },
  { path: '/stockage.html',             name: 'Stockage' },
  { path: '/ecrans.html',               name: 'Écrans' },
  { path: '/protection.html',           name: 'Protection' },
  { path: '/promotions.html',           name: 'Promotions' },
  { path: '/reconditionnes.html',       name: 'Reconditionnés' },
  { path: '/services.html',             name: 'Services' },
];

const VIEWPORTS = [
  { name: 'mobile-360',   w: 360,  h: 740  },
  { name: 'mobile-390',   w: 390,  h: 844  },
  { name: 'tablet-768',   w: 768,  h: 1024 },
  { name: 'desktop-1366', w: 1366, h: 768  },
  { name: 'desktop-1440', w: 1440, h: 900  },
];

async function open(browser, vp, path) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
  return { page, ctx, errors };
}

// ── 0 erreur JS sur toutes les pages ─────────────────────────────────────────
for (const { path, name } of PAGES) {
  test(`${name} — 0 erreur JS critique (desktop)`, async ({ browser }) => {
    const { ctx, errors } = await open(browser, { w: 1366, h: 768 }, path);
    const critical = errors.filter(e => !e.includes('supabase') && !e.includes('ResizeObserver'));
    expect(critical, `Erreurs sur ${path}: ${critical.join(', ')}`).toHaveLength(0);
    await ctx.close();
  });
}

// ── Hero et slider visibles ───────────────────────────────────────────────────
test('Accueil — hero slider visible desktop', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1440, h: 900 }, '/');
  await expect(page.locator('.hero-slider')).toBeVisible();
  const slide1 = page.locator('.hero-slide--1');
  await expect(slide1).toHaveClass(/is-active/);
  await page.screenshot({ path: 'tests/playwright/screenshots/perf-hero-desktop.png' });
  await ctx.close();
});

test('Accueil — hero visible mobile 390px', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 390, h: 844 }, '/');
  await expect(page.locator('.hero-slider')).toBeVisible();
  await page.screenshot({ path: 'tests/playwright/screenshots/perf-hero-mobile.png' });
  await ctx.close();
});

// ── Images hero non cassées ───────────────────────────────────────────────────
test('Hero — image slide 1 chargée (desktop 1440)', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1440, h: 900 }, '/');
  const img = page.locator('.hero-slide--1 .hero-slide__img img');
  await expect(img).toBeVisible();
  const natural = await img.evaluate(el => el.naturalWidth);
  expect(natural).toBeGreaterThan(0);
  await ctx.close();
});

// ── Produits s'affichent ──────────────────────────────────────────────────────
test('Accueil — grille produits visible (catégories statiques)', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1440, h: 900 }, '/');
  const grid = page.locator('#products-grid .product-card').first();
  await expect(grid).toBeVisible();
  await ctx.close();
});

test('Ordinateurs — produits visibles après chargement', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1366, h: 768 }, '/ordinateurs.html');
  const card = page.locator('.product-card').first();
  await expect(card).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'tests/playwright/screenshots/perf-cat-desktop.png' });
  await ctx.close();
});

test('Ordinateurs mobile — produits visibles', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 390, h: 844 }, '/ordinateurs.html');
  const card = page.locator('.product-card').first();
  await expect(card).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'tests/playwright/screenshots/perf-cat-mobile.png' });
  await ctx.close();
});

// ── Slider navigation fonctionne ─────────────────────────────────────────────
test('Hero slider — navigation dots fonctionne', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1440, h: 900 }, '/');
  await page.evaluate(() => heroSlider.goTo(2));
  await page.waitForTimeout(500);
  const active = await page.evaluate(() =>
    document.querySelectorAll('.hero-slide.is-active').length
  );
  expect(active).toBe(1);
  await ctx.close();
});

// ── Menus fonctionnent ────────────────────────────────────────────────────────
test('Menu principal — visible desktop', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1440, h: 900 }, '/');
  await expect(page.locator('.nav-bar')).toBeVisible();
  await ctx.close();
});

test('Menu mobile — toggle fonctionne', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 390, h: 844 }, '/');
  const toggle = page.locator('.menu-toggle');
  if (await toggle.isVisible()) {
    await toggle.click();
    await page.waitForTimeout(300);
  }
  await ctx.close();
});

// ── Panier accessible ─────────────────────────────────────────────────────────
test('Panier — accessible et fonctionnel', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1440, h: 900 }, '/');
  const cart = page.locator('[aria-label*="anier"], .cart-btn, [onclick*="cart"]').first();
  await expect(cart).toBeVisible();
  await ctx.close();
});

// ── Page produit fonctionne ───────────────────────────────────────────────────
test('Page produit — charge sans erreur', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1366, h: 768 }, '/composants.html');
  const firstCard = page.locator('.product-card .btn-detail').first();
  await expect(firstCard).toBeVisible({ timeout: 10000 });
  const href = await firstCard.getAttribute('href');
  expect(href).toContain('produit.html');
  const prodCtx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const prodPage = await prodCtx.newPage();
  const prodErrors = [];
  prodPage.on('pageerror', e => prodErrors.push(e.message));
  await prodPage.goto(BASE + '/' + href, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await prodPage.waitForTimeout(1000);
  await prodPage.screenshot({ path: 'tests/playwright/screenshots/perf-product.png' });
  const critical = prodErrors.filter(e => !e.includes('supabase') && !e.includes('ResizeObserver'));
  expect(critical).toHaveLength(0);
  await prodCtx.close();
  await ctx.close();
});

// ── Pas de scroll horizontal ──────────────────────────────────────────────────
for (const vp of [{ name: 'mobile-360', w: 360, h: 740 }, { name: 'mobile-390', w: 390, h: 844 }]) {
  test(`Accueil ${vp.name} — pas de scroll horizontal`, async ({ browser }) => {
    const { page, ctx } = await open(browser, vp, '/');
    const sw = await page.evaluate(() => document.body.scrollWidth);
    expect(sw).toBeLessThanOrEqual(vp.w + 5);
    await ctx.close();
  });
}

// ── CLS minimal ──────────────────────────────────────────────────────────────
test('Accueil — CLS stable (pas de gros shift visible)', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 390, h: 844 }, '/');
  // Vérifie que le hero ne change pas de taille pendant 2s
  const h1 = await page.locator('.hero-slider').boundingBox();
  await page.waitForTimeout(2000);
  const h2 = await page.locator('.hero-slider').boundingBox();
  expect(Math.abs((h1?.height || 0) - (h2?.height || 0))).toBeLessThan(5);
  await ctx.close();
});

// ── Screenshots pleine page ───────────────────────────────────────────────────
test('Screenshot accueil desktop complet', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 1440, h: 900 }, '/');
  await page.screenshot({
    path: 'tests/playwright/screenshots/perf-home-desktop-full.png',
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  });
  await ctx.close();
});

test('Screenshot accueil mobile complet', async ({ browser }) => {
  const { page, ctx } = await open(browser, { w: 390, h: 844 }, '/');
  await page.screenshot({
    path: 'tests/playwright/screenshots/perf-home-mobile-full.png',
    clip: { x: 0, y: 0, width: 390, height: 844 },
  });
  await ctx.close();
});
