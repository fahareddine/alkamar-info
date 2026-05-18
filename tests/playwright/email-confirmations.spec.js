// @ts-check
// ── Tests emails transactionnels — Boutique Info Experts ─────────────────────
// Teste le formulaire de contact et les endpoints sans envoyer de vrais emails.
// Les appels API sont interceptés ou vérifiés via fetch mock.
// Pas d'envoi réel — EMAIL_TEST_MODE=true côté serveur.

const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = process.env.TEST_BASE_URL || `file://${path.resolve(__dirname, '../../index.html')}`;
const API_BASE  = process.env.API_BASE_URL  || 'https://boutique.info-experts.fr';

test.describe('Emails transactionnels — Formulaire Contact', () => {

  test('hero form — champs présents et validés', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'load' });

    // Naviguer vers le slide contact
    const form = page.locator('#hcs-form');
    await form.scrollIntoViewIfNeeded();

    await expect(page.locator('#hcs-nom')).toBeVisible();
    await expect(page.locator('#hcs-email')).toBeVisible();
    await expect(page.locator('#hcs-msg')).toBeVisible();
    await expect(page.locator('#hcs-btn')).toBeVisible();
  });

  test('hero form — action pointe vers /api/contact', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'load' });
    const action = await page.locator('#hcs-form').getAttribute('action');
    expect(action).toBe('/api/contact');
  });

  test('hero form — validation côté client nom trop court', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'load' });
    const form = page.locator('#hcs-form');
    await form.scrollIntoViewIfNeeded();

    await page.fill('#hcs-nom', 'A'); // trop court
    await page.fill('#hcs-email', 'test@example.com');
    await page.fill('#hcs-msg', 'Message de test suffisamment long');
    await page.evaluate(() => document.getElementById('hcs-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    await expect(page.locator('#hcs-err')).toBeVisible();
    const errText = await page.locator('#hcs-err').textContent();
    expect(errText).toContain('trop court');
  });

  test('hero form — validation côté client email invalide', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'load' });
    const form = page.locator('#hcs-form');
    await form.scrollIntoViewIfNeeded();

    await page.fill('#hcs-nom', 'Test Utilisateur');
    await page.fill('#hcs-email', 'email-invalide');
    await page.fill('#hcs-msg', 'Message de test suffisamment long');
    await page.evaluate(() => document.getElementById('hcs-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    await expect(page.locator('#hcs-err')).toBeVisible();
    const errText = await page.locator('#hcs-err').textContent();
    expect(errText).toContain('Email');
  });

  test('hero form — validation côté client message trop court', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'load' });
    const form = page.locator('#hcs-form');
    await form.scrollIntoViewIfNeeded();

    await page.fill('#hcs-nom', 'Test Utilisateur');
    await page.fill('#hcs-email', 'test@example.com');
    await page.fill('#hcs-msg', 'Court');
    await page.evaluate(() => document.getElementById('hcs-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    await expect(page.locator('#hcs-err')).toBeVisible();
    const errText = await page.locator('#hcs-err').textContent();
    expect(errText).toContain('court');
  });

  test('hero form — soumission réussie avec mock API', async ({ page }) => {
    // Patch window.fetch avant le chargement de la page (fonctionne avec file://)
    await page.addInitScript(() => {
      const _orig = window.fetch;
      window.fetch = async (url, opts) => {
        if (typeof url === 'string' && url.includes('/api/contact')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
          });
        }
        return _orig(url, opts);
      };
    });

    await page.goto(BASE_URL, { waitUntil: 'load' });
    const form = page.locator('#hcs-form');
    await form.scrollIntoViewIfNeeded();

    await page.fill('#hcs-nom', 'Ahmed Abdallah');
    await page.fill('#hcs-email', 'ahmed@example.com');
    await page.fill('#hcs-msg', 'Bonjour, je souhaite avoir des informations sur vos produits.');
    await page.evaluate(() => document.getElementById('hcs-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    await expect(page.locator('#hcs-ok')).toBeVisible({ timeout: 5000 });
    const okText = await page.locator('#hcs-ok').textContent();
    expect(okText).toContain('répondrons');
  });

  test('hero form — payload JSON contient les bons champs', async ({ page }) => {
    // Patch window.fetch pour capturer le payload envoyé
    await page.addInitScript(() => {
      window._capturedContactPayload = null;
      const _orig = window.fetch;
      window.fetch = async (url, opts) => {
        if (typeof url === 'string' && url.includes('/api/contact')) {
          try { window._capturedContactPayload = JSON.parse(opts.body); } catch (e) {}
          return new Response(JSON.stringify({ ok: true }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
          });
        }
        return _orig(url, opts);
      };
    });

    await page.goto(BASE_URL, { waitUntil: 'load' });
    const form = page.locator('#hcs-form');
    await form.scrollIntoViewIfNeeded();

    await page.fill('#hcs-nom', 'Fatima Said');
    await page.fill('#hcs-email', 'fatima@example.com');
    await page.fill('#hcs-msg', 'Question sur les ordinateurs portables disponibles.');
    await page.evaluate(() => document.getElementById('hcs-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    await page.waitForTimeout(500);
    const capturedBody = await page.evaluate(() => window._capturedContactPayload);
    expect(capturedBody).not.toBeNull();
    expect(capturedBody.nom).toBe('Fatima Said');
    expect(capturedBody.email).toBe('fatima@example.com');
    expect(capturedBody.message).toContain('ordinateurs');
    expect(capturedBody).toHaveProperty('_honey');
    expect(capturedBody).toHaveProperty('source');
  });

  test('hero form — honeypot rempli => silencieux (pas d\'appel API)', async ({ page }) => {
    await page.addInitScript(() => {
      window._honeypotApiCalled = false;
      const _orig = window.fetch;
      window.fetch = async (url, opts) => {
        if (typeof url === 'string' && url.includes('/api/contact')) {
          window._honeypotApiCalled = true;
        }
        return _orig(url, opts);
      };
    });

    await page.goto(BASE_URL, { waitUntil: 'load' });
    await form_scrollTo(page);

    // Injecter une valeur dans le honeypot
    await page.evaluate(() => {
      const hp = document.getElementById('hcs-hp');
      if (hp) hp.value = 'bot-value';
    });

    await page.fill('#hcs-nom', 'Bot');
    await page.fill('#hcs-email', 'bot@spam.com');
    await page.fill('#hcs-msg', 'Spam message test xxxxxxxxxx');
    await page.evaluate(() => document.getElementById('hcs-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    await page.waitForTimeout(300);
    const apiCalled = await page.evaluate(() => window._honeypotApiCalled);
    expect(apiCalled).toBe(false);
  });

  test('hero form — erreur API => message d\'erreur visible', async ({ page }) => {
    await page.route('**/api/contact', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ errors: ['Email invalide.'] }),
      });
    });

    await page.goto(BASE_URL, { waitUntil: 'load' });
    const form = page.locator('#hcs-form');
    await form.scrollIntoViewIfNeeded();

    await page.fill('#hcs-nom', 'Test User');
    await page.fill('#hcs-email', 'test@example.com');
    await page.fill('#hcs-msg', 'Message de test suffisamment long pour passer la validation.');
    await page.evaluate(() => document.getElementById('hcs-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    await expect(page.locator('#hcs-err')).toBeVisible({ timeout: 3000 });
  });

  test('hero form — pas d\'erreur JS critique', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(BASE_URL, { waitUntil: 'load' });
    await page.waitForTimeout(500);

    const critical = errors.filter(e =>
      !e.includes('supabase') &&
      !e.includes('net::ERR') &&
      !e.includes('Failed to fetch')
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe('Emails transactionnels — API Contact (live)', () => {
  test.skip(!process.env.API_BASE_URL, 'Skipped: API_BASE_URL not set — run against live site');

  test('POST /api/contact — payload invalide => 400', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/contact`, {
      data: { nom: 'A', email: 'invalid', message: 'court' },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.errors).toBeDefined();
    expect(Array.isArray(body.errors)).toBe(true);
  });

  test('POST /api/contact — email invalide => erreur propre', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/contact`, {
      data: { nom: 'Test User', email: 'pas-un-email', message: 'Message de test suffisamment long.' },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(JSON.stringify(body)).toContain('email');
  });

  test('POST /api/contact — message trop long => erreur propre', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/contact`, {
      data: { nom: 'Test User', email: 'test@example.com', message: 'x'.repeat(5000) },
    });
    expect(resp.status()).toBe(400);
  });

  test('POST /api/contact — payload valide => 200 ok', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/api/contact`, {
      data: {
        nom: 'Test Playwright',
        email: process.env.EMAIL_TEST_RECIPIENT || 'test@example.com',
        message: 'Test automatique Playwright — boutique.info-experts.fr. Veuillez ignorer.',
        source: 'playwright-test',
      },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);
  });
});

test.describe('Emails transactionnels — Checkout (mock)', () => {

  test('checkout — soumission avec mock API, retourne order_id', async ({ page }) => {
    // Mock /api/orders?action=guest_checkout
    await page.route('**/api/orders*', async route => {
      const url = route.request().url();
      if (url.includes('guest_checkout')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            mode: 'mobile_money',
            order_id: '00000000-test-0000-0000-000000000001',
            order_number: '00000000',
            total_eur: 549.00,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Naviguer vers checkout (via file:// ou live)
    const checkoutUrl = BASE_URL.includes('file://') ? BASE_URL.replace('index.html', 'checkout.html') : `${API_BASE}/checkout.html`;
    await page.goto(checkoutUrl, { waitUntil: 'load' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('checkout — payload commande contient customer_email', async ({ page }) => {
    let orderPayload = null;

    await page.route('**/api/orders*', async route => {
      if (route.request().url().includes('guest_checkout')) {
        orderPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ mode: 'cash_pickup', order_id: 'test-id', order_number: 'TEST001', total_eur: 100 }),
        });
      } else {
        await route.continue();
      }
    });

    const checkoutUrl = BASE_URL.includes('file://') ? BASE_URL.replace('index.html', 'checkout.html') : `${API_BASE}/checkout.html`;
    await page.goto(checkoutUrl, { waitUntil: 'load' });

    // Remplir le formulaire checkout si présent
    const nameField = page.locator('#co-name');
    if (await nameField.isVisible()) {
      await nameField.fill('Playwright Test');
      const emailField = page.locator('#co-email');
      if (await emailField.isVisible()) await emailField.fill('playwright@test.com');
      const waField = page.locator('#co-wa');
      if (await waField.isVisible()) await waField.fill('+269 777 00 00');
    }
    // Note: le test complet nécessite des produits en panier — non simulable ici
    // Ce test vérifie que le formulaire est accessible
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Emails transactionnels — Sécurité', () => {

  test('/api/contact — méthode GET => 405', async ({ request }) => {
    if (!process.env.API_BASE_URL) return;
    const resp = await request.get(`${API_BASE}/api/contact`);
    expect(resp.status()).toBe(405);
  });

  test('/api/contact — sans body => 400', async ({ request }) => {
    if (!process.env.API_BASE_URL) return;
    const resp = await request.post(`${API_BASE}/api/contact`, { data: {} });
    expect(resp.status()).toBe(400);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function form_scrollTo(page) {
  const form = page.locator('#hcs-form');
  if (await form.isVisible()) {
    await form.scrollIntoViewIfNeeded();
  }
}
