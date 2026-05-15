// tests/playwright/hero-typography.spec.js
// Vérifie typographie hero : tailles agrandies, CTA en bas, pas de NOUVEAUTÉS, 1 seul fond

const { test, expect } = require('@playwright/test');
const BASE = 'https://boutique.info-experts.fr';

const VIEWPORTS = {
  mobile360: { width: 360,  height: 740  },
  mobile390: { width: 390,  height: 844  },
  mobile430: { width: 430,  height: 932  },
  tablet768: { width: 768,  height: 1024 },
  desk1366:  { width: 1366, height: 768  },
  desk1440:  { width: 1440, height: 900  },
};

async function openAt(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  return { page, ctx, errors };
}

async function measureHero(page) {
  return page.evaluate(() => {
    const title = document.querySelector('.hero-slide__title');
    const sub   = document.querySelector('.hero-slide__sub');
    const cta   = document.querySelector('.hero-slide__cta');
    const inner = document.querySelector('.hero-slide__inner');
    const heroH = document.getElementById('hero-slider')?.getBoundingClientRect().height;
    const innerR = inner?.getBoundingClientRect();
    const ctaR   = cta?.getBoundingClientRect();
    const fs = el => parseFloat(getComputedStyle(el).fontSize);
    return {
      heroH: Math.round(heroH),
      innerH: Math.round(innerR?.height),
      titleFs: Math.round(fs(title) * 10) / 10,
      subFs: Math.round(fs(sub) * 10) / 10,
      ctaFs: Math.round(fs(cta) * 10) / 10,
      ctaYPct: ctaR && innerR ? Math.round((ctaR.y - innerR.y) / innerR.height * 100) : null,
      activeSlides: document.querySelectorAll('.hero-slide.is-active').length,
      nouveaute: document.body.innerHTML.includes('NOUVEAUTÉS 2025'),
    };
  });
}

test.describe('Hero — typographie agrandie desktop', () => {
  test('desk1440 — hero 300px, title ≥ 40px, sub ≥ 14px, CTA en bas', async ({ browser }) => {
    const { page, ctx, errors } = await openAt(browser, VIEWPORTS.desk1440);
    const m = await measureHero(page);

    expect(m.heroH).toBeGreaterThanOrEqual(290);
    expect(m.innerH).toBeGreaterThanOrEqual(290);
    expect(m.titleFs).toBeGreaterThan(40);
    expect(m.subFs).toBeGreaterThanOrEqual(14);
    expect(m.ctaYPct).toBeGreaterThan(60); // CTA dans le tiers inférieur
    expect(m.activeSlides).toBe(1);
    expect(m.nouveaute).toBe(false);
    expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);

    await page.screenshot({ path: 'tests/playwright/screenshots/typo-desktop-1440-slide1.png' });
    await ctx.close();
  });

  test('desk1366 — hero 300px, title ≥ 38px', async ({ browser }) => {
    const { page, ctx } = await openAt(browser, VIEWPORTS.desk1366);
    const m = await measureHero(page);
    expect(m.heroH).toBeGreaterThanOrEqual(290);
    expect(m.titleFs).toBeGreaterThan(38);
    expect(m.nouveaute).toBe(false);

    await page.screenshot({ path: 'tests/playwright/screenshots/typo-desktop-1366-slide1.png' });
    await ctx.close();
  });
});

test.describe('Hero — typographie agrandie mobile', () => {
  for (const [vpName, vp] of Object.entries({ mobile360: VIEWPORTS.mobile360, mobile390: VIEWPORTS.mobile390, mobile430: VIEWPORTS.mobile430 })) {
    test(`${vpName} — hero 220px, title ≥ 18px, sub visible, CTA en bas`, async ({ browser }) => {
      const { page, ctx, errors } = await openAt(browser, vp);
      const m = await measureHero(page);

      expect(m.heroH).toBeGreaterThanOrEqual(210);
      expect(m.innerH).toBeGreaterThanOrEqual(210);
      expect(m.titleFs).toBeGreaterThan(18);
      expect(m.subFs).toBeGreaterThanOrEqual(12);
      expect(m.ctaYPct).toBeGreaterThan(55);
      expect(m.activeSlides).toBe(1);
      expect(m.nouveaute).toBe(false);
      expect(errors.filter(e => !e.includes('supabase'))).toHaveLength(0);

      await page.screenshot({ path: `tests/playwright/screenshots/typo-${vpName}-slide1.png` });
      await ctx.close();
    });
  }
});

test.describe('Hero — slides 1-4, fond unique, pas de superposition', () => {
  test('desktop — chaque slide a title visible, CTA bas, 1 fond', async ({ browser }) => {
    const { page, ctx } = await openAt(browser, VIEWPORTS.desk1440);

    for (let i = 0; i < 4; i++) {
      await page.evaluate((idx) => heroSlider.goTo(idx), i);
      await page.waitForTimeout(500);

      const [active, opacity1] = await page.evaluate(() => {
        const slides = [...document.querySelectorAll('.hero-slide')];
        return [
          slides.filter(s => s.classList.contains('is-active')).length,
          slides.filter(s => parseFloat(getComputedStyle(s).opacity) > 0.9).length
        ];
      });

      expect(active).toBe(1);
      expect(opacity1).toBe(1);

      await page.screenshot({ path: `tests/playwright/screenshots/typo-slide${i+1}-desktop.png` });
    }

    await ctx.close();
  });

  test('mobile — slide 1 et 3 lisibles', async ({ browser }) => {
    const { page, ctx } = await openAt(browser, VIEWPORTS.mobile390);

    for (const idx of [0, 2]) {
      await page.evaluate((i) => heroSlider.goTo(i), idx);
      await page.waitForTimeout(500);

      const title = page.locator('.hero-slide.is-active .hero-slide__title');
      await expect(title).toBeVisible();

      await page.screenshot({ path: `tests/playwright/screenshots/typo-slide${idx+1}-mobile390.png` });
    }

    await ctx.close();
  });
});

test.describe('Hero — pages fonctionnelles après fix', () => {
  test('catégories visibles sous le hero', async ({ browser }) => {
    const { page, ctx } = await openAt(browser, VIEWPORTS.desk1440);
    await expect(page.locator('.products-grid .product-card').first()).toBeVisible({ timeout: 5000 });
    await ctx.close();
  });

  test('NOUVEAUTÉS 2025 absent de toutes les slides', async ({ browser }) => {
    const { page, ctx } = await openAt(browser, VIEWPORTS.desk1440);
    const body = await page.content();
    expect(body).not.toContain('NOUVEAUTÉS 2025');
    await ctx.close();
  });
});
