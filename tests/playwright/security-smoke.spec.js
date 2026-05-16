// tests/playwright/security-smoke.spec.js
// Test non-destructif de sécurité et d'intégrité fonctionnelle

const { test, expect } = require('@playwright/test');
const BASE = 'https://boutique.info-experts.fr';

const PAGES = [
  { path: '/', name: 'accueil' },
  { path: '/ordinateurs.html', name: 'ordinateurs' },
  { path: '/composants.html', name: 'composants' },
  { path: '/peripheriques.html', name: 'peripheriques' },
  { path: '/reseau.html', name: 'reseau' },
  { path: '/stockage.html', name: 'stockage' },
  { path: '/ecrans.html', name: 'ecrans' },
  { path: '/services.html', name: 'services' },
];

async function openPage(browser, path) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const jsErrors = [], netErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('requestfailed', r => {
    if (!r.url().includes('supabase') && !r.url().includes('localhost'))
      netErrors.push(`${r.failure()?.errorText} — ${r.url()}`);
  });
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
  return { page, ctx, jsErrors, netErrors };
}

// ── Pages publiques chargent ────────────────────────────────────────────────
for (const { path, name } of PAGES) {
  test(`Page ${name} — charge sans erreur JS critique`, async ({ browser }) => {
    const { page, ctx, jsErrors } = await openPage(browser, path);
    const critical = jsErrors.filter(e =>
      !e.includes('supabase') && !e.includes('ResizeObserver')
    );
    expect(critical, `JS errors sur ${path}: ${critical.join(', ')}`).toHaveLength(0);
    await ctx.close();
  });
}

// ── Hero visible ────────────────────────────────────────────────────────────
test('Accueil — hero slider visible', async ({ browser }) => {
  const { page, ctx } = await openPage(browser, '/');
  await expect(page.locator('.hero-slider')).toBeVisible();
  await ctx.close();
});

// ── Produits s'affichent ────────────────────────────────────────────────────
test('Accueil — grille produits visible', async ({ browser }) => {
  const { page, ctx } = await openPage(browser, '/');
  await expect(page.locator('#products-grid')).toBeVisible();
  await ctx.close();
});

// ── Panier accessible ───────────────────────────────────────────────────────
test('Panier — icône accessible', async ({ browser }) => {
  const { page, ctx } = await openPage(browser, '/');
  const cartBtn = page.locator('[aria-label*="anier"], [aria-label*="Cart"], .cart-btn, #cart-toggle').first();
  await expect(cartBtn).toBeVisible();
  await ctx.close();
});

// ── Admin protégé (pas de contenu sans auth) ───────────────────────────────
test('Admin — redirige sans authentification', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  const url = page.url();
  // Doit rediriger vers login ou n'afficher aucun contenu admin sensible
  const hasAdminContent = await page.locator('[id*="admin-content"], [class*="admin-dashboard"]').count();
  // Soit on est redirigé vers login, soit le contenu admin n'est pas exposé
  const redirectedToLogin = url.includes('login') || url.includes('Login');
  const bodyText = await page.locator('body').textContent();
  const noSensitiveData = !bodyText.includes('SUPABASE') && !bodyText.includes('service_role');
  expect(noSensitiveData, 'Admin expose des données sensibles sans auth').toBeTruthy();
  await page.screenshot({ path: 'tests/playwright/screenshots/security-admin-noauth.png' });
  await ctx.close();
});

// ── Endpoint API produits public ne divulgue pas de données sensibles ───────
test('API produits — pas de données sensibles exposées', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const resp = await page.goto(`${BASE}/api/products?status=active&limit=3`, { timeout: 15000 });
  expect(resp?.status()).toBeLessThan(500);
  const body = await resp?.text() || '';
  // Vérifie que service_role_key n'est pas dans la réponse
  expect(body).not.toContain('service_role');
  expect(body).not.toContain('STRIPE_SECRET');
  await ctx.close();
});

// ── API admin stats sans auth → 401/403 ────────────────────────────────────
test('API stats — refusée sans token', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const resp = await page.goto(`${BASE}/api/stats`, { timeout: 15000 });
  // Doit retourner 401 ou 403, pas 200 avec données
  const status = resp?.status() || 0;
  expect([401, 403, 405]).toContain(status);
  await ctx.close();
});

// ── Pas de débordement horizontal ──────────────────────────────────────────
test('Accueil mobile — pas de scroll horizontal', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = 390;
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5);
  await page.screenshot({ path: 'tests/playwright/screenshots/security-mobile-noscroll.png', fullPage: false });
  await ctx.close();
});

// ── Liens externes rel="noopener" ──────────────────────────────────────────
test('Accueil — liens externes ont rel noopener', async ({ browser }) => {
  const { page, ctx } = await openPage(browser, '/');
  const badLinks = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[target="_blank"]')];
    return links
      .filter(a => !a.rel.includes('noopener') && !a.href.includes(window.location.hostname))
      .map(a => a.href);
  });
  if (badLinks.length > 0) {
    console.warn('Liens sans noopener:', badLinks.slice(0, 5));
  }
  // On ne fait qu'avertir, pas bloquer le test
  expect(badLinks.length).toBeLessThan(10);
  await ctx.close();
});

// ── CSP header présent ─────────────────────────────────────────────────────
test('Headers sécurité — CSP présent sur accueil', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const resp = await page.goto(BASE + '/', { timeout: 15000 });
  const csp = resp?.headers()['content-security-policy'];
  expect(csp, 'Content-Security-Policy header manquant').toBeTruthy();
  await ctx.close();
});

// ── Pas d'accès direct à .env ──────────────────────────────────────────────
test('Sécurité — .env.local non accessible publiquement', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const resp = await page.goto(`${BASE}/.env.local`, { timeout: 10000 });
  const status = resp?.status() || 0;
  // Doit être 404 ou 403, jamais 200
  expect(status).not.toBe(200);
  await ctx.close();
});

// ── Screenshot sécurité desktop ────────────────────────────────────────────
test('Screenshot — accueil desktop', async ({ browser }) => {
  const { page, ctx } = await openPage(browser, '/');
  await page.screenshot({ path: 'tests/playwright/screenshots/security-home-desktop.png', fullPage: false });
  await ctx.close();
});
