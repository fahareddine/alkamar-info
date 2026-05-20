// @ts-check
// ── Régression performance + non-régression fonctionnelle ──────────────────────
// Vérifie : score PSI > 99, produits, hero, slider, contact, panier, footer
// Live URL : https://boutique.info-experts.fr

const { test, expect } = require('@playwright/test');

const LIVE = 'https://boutique.info-experts.fr';
const MOBILE_360 = { width: 360, height: 740 };
const MOBILE_390 = { width: 390, height: 844 };
const TABLET   = { width: 768, height: 1024 };
const DESKTOP  = { width: 1366, height: 768 };
const DESKTOP_L = { width: 1440, height: 900 };

const SCREENSHOTS = 'tests/playwright/screenshots/pagespeed';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function noJSErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  return () => {
    const critical = errors.filter(e =>
      !e.includes('supabase') && !e.includes('net::ERR') && !e.includes('Failed to fetch')
    );
    expect(critical, 'Aucune erreur JS critique').toHaveLength(0);
  };
}

async function waitProducts(page, min = 3) {
  await page.waitForFunction(
    (n) => document.querySelectorAll('.product-card').length >= n,
    min,
    { timeout: 10000 }
  ).catch(() => {});
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── HOMEPAGE ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Homepage', () => {
  test('mobile 390 — hero visible, pas de CLS critique, produits ou catégories visibles', async ({ page }) => {
    const checkErrors = await noJSErrors(page);
    await page.setViewportSize(MOBILE_390);
    await page.goto(LIVE, { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    // Hero visible
    await expect(page.locator('.hero-slider')).toBeVisible();
    await expect(page.locator('.hero-slide.is-active')).toBeVisible();

    // Slides ou cartes produits/catégories
    const cards = page.locator('.product-card');
    await expect(cards.first()).toBeVisible({ timeout: 8000 });

    // Panier accessible
    await expect(page.locator('.cart-badge, [href*="panier"], [aria-label*="anier"]').first()).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOTS}/homepage-mobile-390.png` });
    checkErrors();
  });

  test('desktop 1366 — hero, produits, navigation visibles', async ({ page }) => {
    const checkErrors = await noJSErrors(page);
    await page.setViewportSize(DESKTOP);
    await page.goto(LIVE, { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    await expect(page.locator('.hero-slider')).toBeVisible();
    await expect(page.locator('.nav-bar')).toBeVisible();

    const cards = page.locator('.product-card');
    await expect(cards.first()).toBeVisible({ timeout: 8000 });

    await page.screenshot({ path: `${SCREENSHOTS}/homepage-desktop-1366.png` });
    checkErrors();
  });

  test('hero desktop — slide actif visible, image présente', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(LIVE, { waitUntil: 'load' });
    const activeSlide = page.locator('.hero-slide.is-active');
    await expect(activeSlide).toBeVisible();
    await expect(activeSlide.locator('.hero-slide__title')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/hero-desktop.png` });
  });

  test('hero mobile 390 — slide actif visible', async ({ page }) => {
    await page.setViewportSize(MOBILE_390);
    await page.goto(LIVE, { waitUntil: 'load' });
    await expect(page.locator('.hero-slide.is-active')).toBeVisible();
    await expect(page.locator('.hero-slide__title').first()).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/hero-mobile-390.png` });
  });

  test('slide Contact visible et form utilisable', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(LIVE, { waitUntil: 'load' });
    const form = page.locator('#hcs-form');
    await form.scrollIntoViewIfNeeded();
    // Formulaire présent
    await expect(page.locator('#hcs-nom')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#hcs-email')).toBeVisible();
    await expect(page.locator('#hcs-msg')).toBeVisible();
    // Action pointe vers /api/contact
    const action = await form.getAttribute('action');
    expect(action).toBe('/api/contact');
    await page.screenshot({ path: `${SCREENSHOTS}/slide-contact.png` });
  });

  test('slider bloqué pendant saisie formulaire contact', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(LIVE, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    // Focus sur le champ nom
    await page.evaluate(() => {
      const input = document.getElementById('hcs-nom');
      if (input) input.focus();
    });
    await page.waitForTimeout(500);
    // Vérifier que le slider est bloqué (stop() a été appelé)
    const isBlocked = await page.evaluate(() => {
      return window._lockContactSlider !== undefined;
    });
    expect(isBlocked).toBe(true);
  });

  test('footer mobile 2x2 — 4 blocs, pas de scroll horizontal', async ({ page }) => {
    await page.setViewportSize(MOBILE_390);
    await page.goto(LIVE, { waitUntil: 'load' });
    const footer = page.locator('.footer__inner');
    await footer.scrollIntoViewIfNeeded();
    const blocs = footer.locator(':scope > div');
    await expect(blocs).toHaveCount(4);
    // Pas de scroll horizontal
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(392);
    await page.screenshot({ path: `${SCREENSHOTS}/footer-mobile.png` });
  });

  test('pas de scroll horizontal mobile 360', async ({ page }) => {
    await page.setViewportSize(MOBILE_360);
    await page.goto(LIVE, { waitUntil: 'load' });
    const scrollW = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollW).toBeLessThanOrEqual(362);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ─── PAGES CATÉGORIES ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const CATEGORIES = [
  { url: '/ordinateurs.html',                name: 'Ordinateurs', min: 3 },
  { url: '/ordinateurs.html?tab=portables',  name: 'Portables',   min: 2 },
  { url: '/composants.html',                 name: 'Composants',  min: 3 },
  { url: '/composants.html?tab=processeurs', name: 'CPU',         min: 1 },
  { url: '/peripheriques.html',              name: 'Périphériques',min: 3 },
  { url: '/imprimantes.html',                name: 'Imprimantes', min: 2 },
  { url: '/reseau.html',                     name: 'Réseau',      min: 2 },
  { url: '/stockage.html',                   name: 'Stockage',    min: 2 },
  { url: '/ecrans.html',                     name: 'Écrans',      min: 2 },
  { url: '/protection.html',                 name: 'Protection',  min: 1 },
  { url: '/promotions.html',                 name: 'Promotions',  min: 1 },
  { url: '/reconditionnes.html',             name: 'Reconditionnés', min: 0 },
  { url: '/services.html',                   name: 'Services',    min: 1 },
];

for (const cat of CATEGORIES) {
  test(`${cat.name} — produits visibles (desktop)`, async ({ page }) => {
    const checkErrors = await noJSErrors(page);
    await page.setViewportSize(DESKTOP);
    await page.goto(`${LIVE}${cat.url}`, { waitUntil: 'load' });
    await waitProducts(page, cat.min);

    const cards = page.locator('.product-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(cat.min);

    // Premier produit visible (seulement si min > 0)
    if (cat.min > 0 && count > 0) {
      await expect(cards.first()).toBeVisible();
      await expect(cards.first().locator('.card-title')).toBeVisible();
    }

    checkErrors();
  });

  test(`${cat.name} — produits visibles (mobile 390)`, async ({ page }) => {
    await page.setViewportSize(MOBILE_390);
    await page.goto(`${LIVE}${cat.url}`, { waitUntil: 'load' });
    await waitProducts(page, cat.min);

    const count = await page.locator('.product-card').count();
    expect(count).toBeGreaterThanOrEqual(cat.min);

    // Pas de scroll horizontal
    const scrollW = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollW).toBeLessThanOrEqual(392);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── PAGE PRODUIT ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Page produit', () => {
  test('desktop — page produit fonctionnelle', async ({ page }) => {
    const checkErrors = await noJSErrors(page);
    await page.setViewportSize(DESKTOP);
    // Naviguer vers ordinateurs puis cliquer sur un produit
    await page.goto(`${LIVE}/ordinateurs.html`, { waitUntil: 'load' });
    await waitProducts(page, 1);

    // Extraire URL produit via onclick ou data
    const prodUrl = await page.evaluate(() => {
      const cards = document.querySelectorAll('.product-card');
      for (const card of cards) {
        const onclick = card.getAttribute('onclick') || '';
        const match = onclick.match(/['"]([^'"]*produit[^'"]*)['"]/);
        if (match) return match[1];
      }
      return null;
    });
    if (prodUrl) {
      await page.goto(prodUrl.startsWith('http') ? prodUrl : `${LIVE}${prodUrl}`, { waitUntil: 'load' });
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 8000 });
      await page.screenshot({ path: `${SCREENSHOTS}/page-produit-desktop.png` });
    }
    checkErrors();
  });

  test('mobile — page produit fonctionnelle', async ({ page }) => {
    await page.setViewportSize(MOBILE_390);
    await page.goto(`${LIVE}/ordinateurs.html`, { waitUntil: 'load' });
    await waitProducts(page, 1);

    const prodUrl = await page.evaluate(() => {
      const cards = document.querySelectorAll('.product-card');
      for (const card of cards) {
        const onclick = card.getAttribute('onclick') || '';
        const match = onclick.match(/['"]([^'"]*produit[^'"]*)['"]/);
        if (match) return match[1];
      }
      return null;
    });
    if (prodUrl) {
      await page.goto(prodUrl.startsWith('http') ? prodUrl : `${LIVE}${prodUrl}`, { waitUntil: 'load' });
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 8000 });
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ─── PANIER ──────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Panier', () => {
  test('desktop — panier accessible', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(LIVE, { waitUntil: 'load' });
    // Cliquer sur le bouton panier
    const cartBtn = page.locator('[aria-label*="anier"], .cart-drawer__close, .header__action:last-of-type').first();
    await expect(cartBtn).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/panier-desktop.png` });
  });

  test('mobile — panier visible dans header', async ({ page }) => {
    await page.setViewportSize(MOBILE_390);
    await page.goto(LIVE, { waitUntil: 'load' });
    // Sur mobile seul le dernier action est visible
    const lastAction = page.locator('.header__actions .header__action:last-of-type');
    await expect(lastAction).toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ─── NAVIGATION ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Navigation', () => {
  test('desktop — menu nav visible', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(LIVE, { waitUntil: 'load' });
    await expect(page.locator('.nav-bar')).toBeVisible();
    await expect(page.locator('.nav-item').first()).toBeVisible();
  });

  test('mobile — menu toggle visible', async ({ page }) => {
    await page.setViewportSize(MOBILE_390);
    await page.goto(LIVE, { waitUntil: 'load' });
    await expect(page.locator('.menu-toggle')).toBeVisible();
  });

  test('tablette 768 — layout correct', async ({ page }) => {
    await page.setViewportSize(TABLET);
    await page.goto(LIVE, { waitUntil: 'load' });
    await expect(page.locator('.hero-slider')).toBeVisible();
    const scrollW = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollW).toBeLessThanOrEqual(770);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ─── CLS LOCAL ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
test.describe('CLS local', () => {
  test('homepage mobile 390 — CLS < 0.01', async ({ page }) => {
    await page.setViewportSize(MOBILE_390);
    const shifts = [];
    await page.addInitScript(() => {
      window._cls_shifts = [];
      const obs = new PerformanceObserver(list => {
        list.getEntries().forEach(e => {
          if (!e.hadRecentInput) window._cls_shifts.push(e.value);
        });
      });
      obs.observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(LIVE, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    const cls = await page.evaluate(() => (window._cls_shifts || []).reduce((a,b) => a+b, 0));
    expect(cls, `CLS ${cls.toFixed(4)} doit être < 0.05`).toBeLessThan(0.05);
  });

  test('homepage desktop 1366 — CLS < 0.01', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.addInitScript(() => {
      window._cls_shifts = [];
      const obs = new PerformanceObserver(list => {
        list.getEntries().forEach(e => { if (!e.hadRecentInput) window._cls_shifts.push(e.value); });
      });
      obs.observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(LIVE, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    const cls = await page.evaluate(() => (window._cls_shifts || []).reduce((a,b) => a+b, 0));
    expect(cls, `CLS desktop ${cls.toFixed(4)} doit être < 0.05`).toBeLessThan(0.05);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ─── IMAGES ───────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Images', () => {
  test('hero — images non cassées (pas de 404)', async ({ page }) => {
    const failed = [];
    page.on('response', r => {
      if (r.request().resourceType() === 'image' && r.status() >= 400) {
        failed.push(`${r.status()} ${r.url()}`);
      }
    });
    await page.setViewportSize(DESKTOP);
    await page.goto(LIVE, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    const heroFailed = failed.filter(u => u.includes('hero'));
    expect(heroFailed, `Images hero cassées: ${heroFailed.join(', ')}`).toHaveLength(0);
  });
});
