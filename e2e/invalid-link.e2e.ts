import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Fully client-side flow — needs no chain or config. An invalid/malformed claim link must be
// recognised entirely on the device and surfaced accessibly (FR-001, FR-008, FR-011).
const INVALID_LINK = '/#k=not-valid-base64!!';

test.describe('invalid claim link', () => {
	test('shows a clear invalid-link message', async ({ page }) => {
		await page.goto(INVALID_LINK);
		const alert = page.getByRole('alert');
		await expect(alert).toBeVisible();
		await expect(alert).toContainText(/invalid/i);
	});

	test('clears the key from the URL fragment on load', async ({ page }) => {
		await page.goto(INVALID_LINK);
		await expect(page.getByRole('alert')).toBeVisible();
		expect(new URL(page.url()).hash).toBe('');
	});

	test('has no axe accessibility violations', async ({ page }) => {
		await page.goto(INVALID_LINK);
		await expect(page.getByRole('alert')).toBeVisible();
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations).toEqual([]);
	});
});
