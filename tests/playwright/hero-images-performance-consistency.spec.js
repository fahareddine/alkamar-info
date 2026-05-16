// tests/playwright/hero-images-performance-consistency.spec.js
// Vérifie : images héro visibles, boutons CTA fonctionnels, pages cibles correctes

const { test, expect } = require('@playwright/test');

const BASE = 'https://boutique.info-experts.fr';

const VIEWPORTS = [
  { name: 'mobile-360',  width: 360,  height: 740  },
  { name: 'mobile-390',  width: 390,  height: 844  },
  { name: 'mobile-430',  width: 430,  height: 932  },
  { name: 'tablet-768',  width: 768,  height: 1024 },
  { name: 'desktop-1366',width: 1366, height: 768  },
  { name: 'desktop-1440',width: 1440, height: 900  },
];

const SLIDES = [
  {
    index: 0,
    title: 'Portables',
    ctaText: 'Voir les portables',
    ctaUrl:  '/ordinateurs.html?tab=portables',
    imgSrc:  '/images/hero/slide-portables',
    imgAlt:  'PC Portables Dell HP',
  },
  {
    index: 1,
    title: 'Reconditionnés',
    ctaText: 'Découvrir les reconditionnés',
    ctaUrl:  '/ordinateurs.html?tab=reconditiones',
    imgSrc:  '/images/hero/slide-reconditiones',
    imgAlt:  'PC bureau reconditionnés',
  },
  {
    index: 2,
    title: 'Composants',
    ctaText: 'Explorer les composants',
    ctaUrl:  '/composants.html',
    imgSrc:  '/images/hero/slide-composants',
    imgAlt:  'Composants PC',
  },
  {
    index: 3,
    title: 'Réseau',
    ctaText: 'Voir le réseau',
    ctaUrl:  '/reseau.html',
    imgSrc:  '/images/hero/slide-reseau',
    imgAlt:  'Routeurs WiFi',
  },
  {
    index: 4,
    title: 'Services',
    ctaText: 'Nos services',
    ctaUrl:  '/services.html',
    imgSrc:  '/images/hero/slide-services',
    imgAlt:  'Services informatiques',
  },
];

async function openPage(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  return { page, ctx, errors };
}

// ── Vérification images par viewport ──────────────────────────────────────────
for (const vp of VIEWPORTS) {
  test.describe(`Hero images — ${vp.name}`, () => {
    test('0 erreur JS console', async ({ browser }) => {
      const { page, ctx, errors } = await openPage(browser, vp);
      await page.waitForTimeout(500);
      const criticalErrors = errors.filter(e =>
        !e.includes('supabase') && !e.includes('ResizeObserver')
      );
      expect(criticalErrors).toHaveLength(0);
      await ctx.close();
    });

    test('hero visible', async ({ browser }) => {
      const { page, ctx } = await openPage(browser, vp);
      const hero = page.locator('.hero-slider');
      await expect(hero).toBeVisible();
      await ctx.close();
    });

    test('slide 1 actif au chargement', async ({ browser }) => {
      const { page, ctx } = await openPage(browser, vp);
      const slide1 = page.locator('.hero-slide--1');
      await expect(slide1).toHaveClass(/is-active/);
      await ctx.close();
    });

    // Images uniquement visibles sur tablette+
    if (vp.width >= 481) {
      test('image slide 1 visible et chargée', async ({ browser }) => {
        const { page, ctx } = await openPage(browser, vp);
        const img = page.locator('.hero-slide--1 .hero-slide__img img');
        await expect(img).toBeVisible();
        const natural = await img.evaluate(el => el.naturalWidth);
        expect(natural).toBeGreaterThan(0);
        await ctx.close();
      });
    }

    test(`screenshot hero ${vp.name}`, async ({ browser }) => {
      const { page, ctx } = await openPage(browser, vp);
      await page.screenshot({
        path: `tests/playwright/screenshots/hero-${vp.name}-slide1.png`,
        fullPage: false,
      });
      await ctx.close();
    });
  });
}

// ── Slides desktop — navigation + images ──────────────────────────────────────
test.describe('Hero slides desktop — images visibles non cassées', () => {
  test('chaque slide a une image chargée', async ({ browser }) => {
    const { page, ctx } = await openPage(browser, { width: 1440, height: 900 });

    for (const slide of SLIDES) {
      await page.evaluate(idx => heroSlider.goTo(idx), slide.index);
      await page.waitForTimeout(500);

      const imgEl = page.locator(`.hero-slide--${slide.index + 1} .hero-slide__img img`);
      await expect(imgEl).toBeVisible({ timeout: 3000 });

      const natural = await imgEl.evaluate(el => el.naturalWidth);
      expect(natural).toBeGreaterThan(0);

      const box = await imgEl.boundingBox();
      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThan(50);
      expect(box.height).toBeGreaterThan(30);

      await page.screenshot({
        path: `tests/playwright/screenshots/hero-desktop-slide${slide.index + 1}.png`,
        fullPage: false,
      });
    }

    await ctx.close();
  });
});

// ── Services slide spécifique ──────────────────────────────────────────────────
test.describe('Slide Services — image équipe comorienne', () => {
  test('desktop — image services visible et correcte', async ({ browser }) => {
    const { page, ctx } = await openPage(browser, { width: 1440, height: 900 });
    await page.evaluate(() => heroSlider.goTo(4));
    await page.waitForTimeout(500);

    const img = page.locator('.hero-slide--5 .hero-slide__img img');
    await expect(img).toBeVisible();

    const natural = await img.evaluate(el => el.naturalWidth);
    expect(natural).toBeGreaterThan(0);

    const src = await img.getAttribute('src');
    expect(src).toContain('slide-services');

    await page.screenshot({
      path: 'tests/playwright/screenshots/hero-services-desktop.png',
      fullPage: false,
    });
    await ctx.close();
  });

  test('mobile 390 — slide services image masquée (< 480px ok)', async ({ browser }) => {
    const { page, ctx } = await openPage(browser, { width: 390, height: 844 });
    await page.evaluate(() => heroSlider.goTo(4));
    await page.waitForTimeout(500);

    // Sur < 480px le texte/CTA restent visibles
    const cta = page.locator('.hero-slide--5 .hero-slide__cta');
    await expect(cta).toBeVisible();

    await page.screenshot({
      path: 'tests/playwright/screenshots/hero-services-mobile.png',
      fullPage: false,
    });
    await ctx.close();
  });
});

// ── CTA buttons → pages cibles ────────────────────────────────────────────────
test.describe('CTA boutons — navigation vers pages cibles', () => {
  const targets = [
    { slide: 0, url: '/ordinateurs.html?tab=portables',    label: 'portables' },
    { slide: 1, url: '/ordinateurs.html?tab=reconditiones',label: 'reconditionnés' },
    { slide: 2, url: '/composants.html',                   label: 'composants' },
    { slide: 3, url: '/reseau.html',                       label: 'réseau' },
    { slide: 4, url: '/services.html',                     label: 'services' },
  ];

  for (const t of targets) {
    test(`slide ${t.slide + 1} — CTA vers ${t.label}`, async ({ browser }) => {
      const { page, ctx } = await openPage(browser, { width: 1440, height: 900 });

      await page.evaluate(idx => heroSlider.goTo(idx), t.slide);
      await page.waitForTimeout(400);

      const cta = page.locator(`.hero-slide--${t.slide + 1} .hero-slide__cta`);
      await expect(cta).toBeVisible();

      const href = await cta.getAttribute('href');
      expect(href).toContain(t.url.split('?')[0]);

      // Clic et vérification chargement page cible
      await Promise.all([
        page.waitForURL(`${BASE}${t.url.split('?')[0]}**`, { timeout: 15000 }),
        cta.click(),
      ]);

      await expect(page).toHaveURL(new RegExp(t.url.split('?')[0].replace('/', '\\/')));

      await page.screenshot({
        path: `tests/playwright/screenshots/hero-cta-${t.label}.png`,
        fullPage: false,
      });

      await ctx.close();
    });
  }
});

// ── Cohérence slides images non cassées mobile tablette ───────────────────────
test.describe('Slides images — tablette 768px', () => {
  test('slides 1-4 images visibles sur tablette', async ({ browser }) => {
    const { page, ctx } = await openPage(browser, { width: 768, height: 1024 });

    for (let i = 0; i < 5; i++) {
      await page.evaluate(idx => heroSlider.goTo(idx), i);
      await page.waitForTimeout(400);

      const img = page.locator(`.hero-slide--${i + 1} .hero-slide__img img`);
      const natural = await img.evaluate(el => el.naturalWidth);
      expect(natural).toBeGreaterThan(0);
    }

    await page.evaluate(() => heroSlider.goTo(4));
    await page.waitForTimeout(400);
    await page.screenshot({
      path: 'tests/playwright/screenshots/hero-services-tablet.png',
      fullPage: false,
    });

    await ctx.close();
  });
});
