// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const PAGE_URL = `file://${path.resolve(__dirname, '../../index.html')}`;

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 740 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');

test.describe('Footer mobile layout 2x2', () => {
  for (const vp of VIEWPORTS) {
    test(`footer visible — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(PAGE_URL, { waitUntil: 'load' });

      const footer = page.locator('footer.footer');
      await expect(footer).toBeVisible();

      const inner = page.locator('.footer__inner');
      await expect(inner).toBeVisible();

      // Screenshot footer
      await footer.scrollIntoViewIfNeeded();
      await footer.screenshot({
        path: path.join(SCREENSHOTS_DIR, `footer-${vp.name}.png`),
      });
    });
  }

  test('mobile 390 — 4 blocs visibles en 2x2', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    const inner = page.locator('.footer__inner');
    await inner.scrollIntoViewIfNeeded();

    // Attendre CSS grille appliquée (async preload sur file://)
    await page.waitForFunction(() => {
      const el = document.querySelector('.footer__inner');
      return getComputedStyle(el).gridTemplateColumns.includes('px');
    });

    const blocs = inner.locator(':scope > div');
    await expect(blocs).toHaveCount(4);

    // Vérifier que chaque bloc est visible
    for (let i = 0; i < 4; i++) {
      await expect(blocs.nth(i)).toBeVisible();
    }

    // Vérifier grille 2 colonnes : les 2 premiers blocs doivent être côte à côte (même top)
    const b0 = await blocs.nth(0).boundingBox();
    const b1 = await blocs.nth(1).boundingBox();
    const b2 = await blocs.nth(2).boundingBox();
    const b3 = await blocs.nth(3).boundingBox();

    expect(b0).not.toBeNull();
    expect(b1).not.toBeNull();
    expect(b2).not.toBeNull();
    expect(b3).not.toBeNull();

    // Ligne 1 : b0 et b1 ont le même top (tolérance 5px)
    expect(Math.abs(b0.y - b1.y)).toBeLessThan(5);
    // Ligne 2 : b2 et b3 ont le même top (tolérance 5px)
    expect(Math.abs(b2.y - b3.y)).toBeLessThan(5);
    // Ligne 2 est en dessous de ligne 1
    expect(b2.y).toBeGreaterThan(b0.y + 10);

    // Pas de débordement horizontal
    const footerBox = await page.locator('footer.footer').boundingBox();
    expect(footerBox.width).toBeLessThanOrEqual(390 + 1);
  });

  test('mobile 360 — 2 colonnes, pas de débordement', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    // Attendre CSS grille appliquée (async preload sur file://)
    await page.waitForFunction(() => {
      const el = document.querySelector('.footer__inner');
      return getComputedStyle(el).gridTemplateColumns.includes('px');
    });

    // Vérifier 2 colonnes via computed style
    const cols = await page.evaluate(() => {
      const el = document.querySelector('.footer__inner');
      return getComputedStyle(el).gridTemplateColumns;
    });
    const tracks = cols.trim().split(/\s+/);
    expect(tracks.length).toBe(2);

    // Pas de débordement horizontal
    const footerBox = await page.locator('footer.footer').boundingBox();
    expect(footerBox.width).toBeLessThanOrEqual(361);
  });

  test('Bloc 1 — brand et contact visibles', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    await expect(page.locator('.footer-brand')).toBeVisible();
    await expect(page.locator('.footer-desc')).toBeVisible();
    await expect(page.locator('.footer-contact')).toBeVisible();
    // Lien téléphone cliquable
    await expect(page.locator('.footer-contact a[href^="tel:"]')).toBeVisible();
    // Lien email cliquable
    await expect(page.locator('.footer-contact a[href^="mailto:"]')).toBeVisible();
  });

  test('Blocs 2/3/4 — titres et liens visibles', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    const titles = page.locator('.footer-col__title');
    await expect(titles).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(titles.nth(i)).toBeVisible();
    }

    const links = page.locator('.footer-col__links a');
    const count = await links.count();
    expect(count).toBeGreaterThan(5);
  });

  test('Mentions légales accessibles', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    await expect(page.locator('a[href="mentions-legales.html"]')).toBeVisible();
    await expect(page.locator('a[href="cgv.html"]')).toBeVisible();
  });

  test('Footer bottom visible — paiements', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    await expect(page.locator('.footer__bottom')).toBeVisible();
    await expect(page.locator('.footer__pay')).toBeVisible();
  });

  test('Desktop 1366 — 4 colonnes intactes', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    const inner = page.locator('.footer__inner');
    await inner.scrollIntoViewIfNeeded();

    const blocs = inner.locator(':scope > div');
    await expect(blocs).toHaveCount(4);

    // Vérifier 4 colonnes via gridTemplateColumns computé
    const cols = await page.evaluate(() => {
      const el = document.querySelector('.footer__inner');
      return getComputedStyle(el).gridTemplateColumns;
    });
    const tracks = cols.trim().split(/\s+/);
    expect(tracks.length).toBe(4);

    // b0 et b1 alignés en haut
    const b0 = await blocs.nth(0).boundingBox();
    const b1 = await blocs.nth(1).boundingBox();
    expect(Math.abs(b0.y - b1.y)).toBeLessThan(5);
  });

  test('Page complète — screenshots mobile et desktop', async ({ page }) => {
    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE_URL, { waitUntil: 'load' });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'footer-page-complete-mobile-390.png'),
      fullPage: true,
    });

    // Desktop
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(PAGE_URL, { waitUntil: 'load' });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'footer-page-complete-desktop-1366.png'),
      fullPage: true,
    });
  });

  test('Aucune erreur JS critique', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE_URL, { waitUntil: 'load' });
    await page.waitForTimeout(800);

    const critical = errors.filter(
      (e) => !e.includes('net::ERR') && !e.includes('Failed to fetch') && !e.includes('supabase')
    );
    expect(critical).toHaveLength(0);
  });
});
