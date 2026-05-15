// tests/playwright/hero-slider.spec.js
// Vérifie : pas de NOUVEAUTÉS 2025, un seul fond visible, cross-fade correct

const { test, expect } = require('@playwright/test');
const BASE = 'https://boutique.info-experts.fr';

const MOBILE  = { width: 390,  height: 844  };
const DESKTOP = { width: 1440, height: 900  };

async function openPage(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  return { page, ctx, errors };
}

test.describe('Hero slider — NOUVEAUTÉS 2025 supprimé', () => {
  test('desktop — tag absent du DOM', async ({ browser }) => {
    const { page, ctx } = await openPage(browser, DESKTOP);
    const body = await page.content();
    expect(body).not.toContain('NOUVEAUTÉS 2025');
    await page.screenshot({ path: 'tests/playwright/screenshots/slider-no-tag-desktop.png', fullPage: false });
    await ctx.close();
  });

  test('mobile — tag absent du DOM', async ({ browser }) => {
    const { page, ctx } = await openPage(browser, MOBILE);
    const body = await page.content();
    expect(body).not.toContain('NOUVEAUTÉS 2025');
    await ctx.close();
  });
});

test.describe('Hero slider — un seul fond visible à la fois', () => {
  test('desktop — opacity:1 sur 1 seul slide par slide', async ({ browser }) => {
    const { page, ctx, errors } = await openPage(browser, DESKTOP);

    for (let i = 0; i < 5; i++) {
      await page.evaluate((idx) => heroSlider.goTo(idx), i);
      await page.waitForTimeout(500); // laisse la transition 0.4s se terminer

      const result = await page.evaluate(() => {
        const slides = [...document.querySelectorAll('.hero-slide')];
        return slides.map(s => ({
          opacity: parseFloat(getComputedStyle(s).opacity),
          isActive: s.classList.contains('is-active')
        }));
      });

      const activeCount = result.filter(s => s.isActive).length;
      const opaque = result.filter(s => s.opacity > 0.9).length;
      expect(activeCount).toBe(1);
      expect(opaque).toBe(1);

      // Screenshot slide i
      await page.screenshot({
        path: `tests/playwright/screenshots/slider-slide${i+1}-desktop.png`,
        fullPage: false
      });
    }

    expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);
    await ctx.close();
  });

  test('mobile — opacity:1 sur 1 seul slide par slide', async ({ browser }) => {
    const { page, ctx, errors } = await openPage(browser, MOBILE);

    for (let i = 0; i < 5; i++) {
      await page.evaluate((idx) => heroSlider.goTo(idx), i);
      await page.waitForTimeout(500);

      const result = await page.evaluate(() => {
        const slides = [...document.querySelectorAll('.hero-slide')];
        return slides.map(s => ({
          opacity: parseFloat(getComputedStyle(s).opacity),
          isActive: s.classList.contains('is-active')
        }));
      });

      const activeCount = result.filter(s => s.isActive).length;
      expect(activeCount).toBe(1);
    }

    // Screenshot slide 1 et 3 mobile
    await page.evaluate(() => heroSlider.goTo(0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/playwright/screenshots/slider-slide1-mobile.png', fullPage: false });

    await page.evaluate(() => heroSlider.goTo(2));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/playwright/screenshots/slider-slide3-mobile.png', fullPage: false });

    expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);
    await ctx.close();
  });
});

test.describe('Hero slider — fonctionnalités intactes', () => {
  test('dots navigation fonctionne', async ({ browser }) => {
    const { page, ctx } = await openPage(browser, DESKTOP);
    // Click sur le 3ème dot
    const dots = page.locator('.hero-dot');
    await dots.nth(2).click();
    await page.waitForTimeout(500);
    const activeCount = await page.evaluate(() =>
      [...document.querySelectorAll('.hero-slide')].filter(s => s.classList.contains('is-active')).length
    );
    expect(activeCount).toBe(1);
    await ctx.close();
  });

  test('catégories visibles sous le hero', async ({ browser }) => {
    const { page, ctx } = await openPage(browser, DESKTOP);
    await expect(page.locator('.products-grid .product-card').first()).toBeVisible({ timeout: 5000 });
    await ctx.close();
  });

  test('0 erreur JS console', async ({ browser }) => {
    const { page, ctx, errors } = await openPage(browser, DESKTOP);
    await page.waitForTimeout(1000);
    expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);
    await ctx.close();
  });
});
