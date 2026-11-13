// Smoke test: navigare anonimă + fără erori JS + fără scroll orizontal pe mobil.
// NECESITĂ: npm i && npx playwright install chromium. Nerulat încă pe codul real — ajustează selectorii dacă navigația diferă.
const { test, expect } = require('@playwright/test');

const VIEWS = ['Acasă', 'Flux', 'Hartă ONG-uri', 'Evenimente', 'Oameni', 'Colaborări', 'Finanțări', 'Resurse'];

test('navigare anonimă prin toate secțiunile, fără erori', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('/');
  for (const v of VIEWS) {
    const link = page.getByText(v, { exact: true }).first();
    if (await link.isVisible()) await link.click();       // pe mobil meniul poate fi ascuns -> sărim
    await page.waitForTimeout(300);
  }
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('nu există scroll orizontal', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test('fără date demo hard-coded în pagină', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500);
  const html = await page.content();
  for (const bad of ['lorem ipsum', 'John Doe', 'Maria Popescu', 'example.com']) expect(html.toLowerCase()).not.toContain(bad.toLowerCase());
});

test('contul este opțional și formularul de înregistrare explică acest lucru', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /intră \/ creează cont/i }).click();
  await expect(page.getByRole('heading', { name: 'Creează-ți un cont' })).toBeVisible();
  await expect(page.getByText(/contul este opțional/i)).toBeVisible();
});

test('înscrierea la eveniment cere date de contact, fără cont', async ({ page }) => {
  await page.goto('/');
  const eventButton = page.getByRole('button', { name: /înscrie-te/i }).first();
  if (await eventButton.count()) {
    await eventButton.click();
    await page.getByRole('button', { name: /confirmă înscrierea/i }).click();
    await expect(page.getByText(/completează numele și adresa de email/i)).toBeVisible();
  }
});

test.describe('utilizator autentificat', () => {
  test.skip(!process.env.E2E_EMAIL, 'setează E2E_EMAIL / E2E_PASSWORD (cont de test) pentru a rula');
  test('TODO: login -> creează ONG -> apare „în așteptare” în Contribuțiile mele', async () => {
    // De completat după ce fluxul de login din index.html este cunoscut.
  });
});