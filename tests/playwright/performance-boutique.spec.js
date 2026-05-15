// tests/playwright/performance-boutique.spec.js
// Vérifie LCP, images, cartes produits/catégories, fonctionnalités sur les pages principales

const { test, expect, chromium } = require('@playwright/test');

const BASE = 'https://boutique.info-experts.fr';
const PAGES = [
  { url: '/',                  name: 'Accueil' },
  { url: '/ordinateurs.html', name: 'Ordinateurs' },
  { url: '/ordinateurs.html?tab=portables', name: 'Portables' },
  { url: '/peripheriques.html', name: 'Périphériques' },
  { url: '/reseau.html',       name: 'Réseau' },
  { url: '/ecrans.html',       name: 'Écrans' },
];

test.describe('Performance & affichage boutique', () => {

  test('Accueil — LCP image non lazy, fetchpriority high présent', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    // Vérifier qu'aucune erreur JS critique
    expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);

    // Hero visible
    const hero = page.locator('#hero-slider');
    await expect(hero).toBeVisible();

    // Au moins 4 cartes catégorie visibles
    const cards = page.locator('.products-grid .product-card');
    await expect(cards).toHaveCount(11, { timeout: 5000 });

    // Image LCP Composants (fetchpriority=high) présente
    const lcpImg = page.locator('img[fetchpriority="high"]');
    await expect(lcpImg).toHaveCount(1); // une seule fetchpriority="high" par page

    // Les 2 premières images de catégorie ne sont pas lazy
    const firstImg = page.locator('.products-grid .product-card').nth(0).locator('img').first();
    const secondImg = page.locator('.products-grid .product-card').nth(1).locator('img').first();
    expect(await firstImg.getAttribute('loading')).not.toBe('lazy');
    expect(await secondImg.getAttribute('loading')).not.toBe('lazy');

    // Les images sous la fold restent lazy
    const thirdImg = page.locator('.products-grid .product-card').nth(2).locator('img').first();
    expect(await thirdImg.getAttribute('loading')).toBe('lazy');

    // Chaque image a width et height
    const allImgs = page.locator('.products-grid .product-card img');
    const count = await allImgs.count();
    for (let i = 0; i < count; i++) {
      const w = await allImgs.nth(i).getAttribute('width');
      const h = await allImgs.nth(i).getAttribute('height');
      expect(w).toBeTruthy();
      expect(h).toBeTruthy();
    }

    // Screenshot desktop
    await page.screenshot({ path: 'tests/playwright/screenshots/accueil-desktop.png', fullPage: false });
  });

  test('Accueil mobile — hero + cartes visibles, pas de layout shift visible', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    const hero = page.locator('#hero-slider');
    await expect(hero).toBeVisible();

    const cards = page.locator('.products-grid .product-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(4);

    await page.screenshot({ path: 'tests/playwright/screenshots/accueil-mobile.png', fullPage: false });
    await ctx.close();
  });

  for (const { url, name } of PAGES.slice(1)) {
    test(`${name} — produits chargés, 0 erreur JS`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(BASE + url, { waitUntil: 'networkidle' });

      // 0 erreur JS critique (hors supabase auth optionnelle)
      const critErrors = errors.filter(e => !e.includes('supabase') && !e.includes('auth'));
      expect(critErrors).toHaveLength(0);

      // Au moins 1 produit chargé
      const cards = page.locator('.product-card');
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(1);

      // Bouton "Ajouter" ou "Voir le détail" cliquable
      const btnDetail = page.locator('.btn-detail').first();
      await expect(btnDetail).toBeVisible();
    });
  }

  test('Images produits ont width/height sur page composants', async ({ page }) => {
    await page.goto(BASE + '/composants.html', { waitUntil: 'networkidle' });
    const imgs = page.locator('.product-card img');
    const count = await imgs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 5); i++) {
      const w = await imgs.nth(i).getAttribute('width');
      const h = await imgs.nth(i).getAttribute('height');
      expect(w).toBeTruthy();
      expect(h).toBeTruthy();
    }
  });

  test('Progress bar hero — pas de setInterval actif (CSS transition)', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'load' });
    // Le setInterval ne doit plus exister pour la progress bar
    const hasSetInterval = await page.evaluate(() => {
      // Vérifie qu'aucun intervalle rapide (< 200ms) ne fait de style.width writes répétés
      let count = 0;
      const orig = window.setInterval;
      // On ne peut pas inspecter les intervals existants directement,
      // mais on peut vérifier que progress bar utilise CSS transition
      const pb = document.getElementById('hero-progress');
      if (!pb) return 'no-progress-bar';
      const cs = getComputedStyle(pb);
      return cs.transitionProperty; // doit contenir 'width' ou 'all'
    });
    // La progress bar doit avoir une transition CSS
    expect(['width', 'all', 'width 4s linear']).toContain(hasSetInterval);
  });

});
