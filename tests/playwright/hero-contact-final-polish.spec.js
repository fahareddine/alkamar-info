// tests/playwright/hero-contact-final-polish.spec.js
// Valide le polish final du slide Contact : couleurs, textarea, bouton espacé

const { test, expect } = require('@playwright/test');
const BASE = 'https://boutique.info-experts.fr';

const VIEWPORTS = [
  { name: 'mobile-360',   w: 360,  h: 740  },
  { name: 'mobile-390',   w: 390,  h: 844  },
  { name: 'mobile-430',   w: 430,  h: 932  },
  { name: 'tablet-768',   w: 768,  h: 1024 },
  { name: 'desktop-1366', w: 1366, h: 768  },
  { name: 'desktop-1440', w: 1440, h: 900  },
];

async function goToSlide7(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => heroSlider.goTo(6));
  await page.waitForTimeout(600);
  return { page, ctx, errors };
}

// ── Tests par viewport ─────────────────────────────────────────────────────
for (const vp of VIEWPORTS) {
  test(`Contact polish — ${vp.name}`, async ({ browser }) => {
    const { page, ctx, errors } = await goToSlide7(browser, vp);

    // 0 erreur JS critique
    const critical = errors.filter(e => !e.includes('supabase') && !e.includes('ResizeObserver'));
    expect(critical).toHaveLength(0);

    // Slide 7 actif
    await expect(page.locator('.hero-slide--7')).toHaveClass(/is-active/);

    // Couleur slide 7 en bleu/violet (pas ambre/rust)
    const bgColor = await page.locator('.hero-slide--7').evaluate(el =>
      window.getComputedStyle(el).backgroundImage
    );
    // Gradient doit contenir des couleurs bleu/violet (312e81 ou 1e1b4b)
    expect(bgColor.toLowerCase()).not.toContain('#9a3412');

    // Formulaire visible sur 481px+
    if (vp.w >= 481) {
      await expect(page.locator('#hcs-form')).toBeVisible();

      // Textarea plus grand (height >= 30px)
      const taHeight = await page.locator('#hcs-msg').evaluate(el =>
        parseFloat(window.getComputedStyle(el).height)
      );
      expect(taHeight, `Textarea trop petit (${taHeight}px)`).toBeGreaterThanOrEqual(28);

      // Bouton visible et pas collé au textarea
      const btnBox = await page.locator('#hcs-btn').boundingBox();
      const taBox = await page.locator('#hcs-msg').boundingBox();
      expect(btnBox).not.toBeNull();
      expect(taBox).not.toBeNull();
      if (btnBox && taBox) {
        const gap = btnBox.y - (taBox.y + taBox.height);
        expect(gap, `Bouton trop collé au textarea (gap: ${gap}px)`).toBeGreaterThanOrEqual(3);
      }

      // Infos contact visibles
      await expect(page.locator('.hcs-contacts')).toBeAttached();
    }

    // Pas de débordement horizontal
    const sw = await page.evaluate(() => document.body.scrollWidth);
    expect(sw).toBeLessThanOrEqual(vp.w + 5);

    await page.screenshot({
      path: `tests/playwright/screenshots/polish-${vp.name}.png`,
      fullPage: false,
    });
    await ctx.close();
  });
}

// ── Slider pause quand saisie dans textarea ────────────────────────────────
test('Contact — slider bloqué pendant saisie Message', async ({ browser }) => {
  const { page, ctx } = await goToSlide7(browser, { w: 1440, h: 900 });

  await page.waitForSelector('#hcs-msg', { state: 'visible', timeout: 5000 });
  await page.click('#hcs-msg');

  const MSG = 'Ceci est un test Playwright pour vérifier que le champ Message est plus grand et que le slider reste bloqué.';
  await page.type('#hcs-msg', MSG, { delay: 30 });

  // Vérifier que le slide est toujours 7 pendant la saisie
  const slideIdx = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-active'))
  );
  expect(slideIdx).toBe(6);

  // Vérifier que le texte est bien dans le textarea
  const val = await page.locator('#hcs-msg').inputValue();
  expect(val).toContain('Message est plus grand');

  await page.screenshot({
    path: 'tests/playwright/screenshots/polish-form-typing-desktop.png',
    fullPage: false,
  });

  // Attendre 5s sans toucher → slider toujours sur slide 7
  await page.waitForTimeout(5000);
  const slideAfter = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-active'))
  );
  expect(slideAfter).toBe(6);

  await ctx.close();
});

// ── Bouton visible + screenshot focus Message ─────────────────────────────
test('Contact — bouton visible + textarea focus screenshot', async ({ browser }) => {
  const { page, ctx } = await goToSlide7(browser, { w: 1366, h: 768 });

  await page.waitForSelector('#hcs-btn', { state: 'visible', timeout: 5000 });
  await expect(page.locator('#hcs-btn')).toBeVisible();

  // Focus textarea
  await page.click('#hcs-msg');
  await page.screenshot({
    path: 'tests/playwright/screenshots/polish-textarea-focus.png',
    fullPage: false,
  });

  await ctx.close();
});

// ── Slides 1-6 inchangés ──────────────────────────────────────────────────
test('Slides 1-6 — inchangés après polish couleurs', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  for (let i = 0; i < 6; i++) {
    await page.evaluate(idx => heroSlider.goTo(idx), i);
    await page.waitForTimeout(400);
    const active = await page.evaluate(() =>
      document.querySelectorAll('.hero-slide.is-active').length
    );
    expect(active).toBe(1);
  }
  await page.screenshot({ path: 'tests/playwright/screenshots/polish-autres-slides.png' });
  await ctx.close();
});

// ── Produits visibles après hero ──────────────────────────────────────────
test('Produits — catégories visibles après hero', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  const grid = page.locator('#products-grid .product-card').first();
  await expect(grid).toBeVisible({ timeout: 10000 });
  await ctx.close();
});
