import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { hexToBytes } from 'viem'
import { toBase64Url } from '../src/lib/claim/link'

// The "ready" key is whitelisted and unused, so a valid link reaches the claim form.
const READY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const link = `/#k=${toBase64Url(hexToBytes(READY))}`

test('a whitelisted link reaches the claim form (US1)', async ({ page }) => {
	await page.goto(link)
	await expect(page.getByLabel('Name')).toBeVisible()
	await expect(page.getByLabel('Resolves to address')).toBeVisible()
})

test('previews the normalized name as the user types (US3)', async ({ page }) => {
	await page.goto(link)
	await page.getByLabel('Name').fill('Alice')
	await expect(page.getByText('Will register: alice.black.ygg.army')).toBeVisible()
})

test('shows inline errors for an invalid name and address (US3)', async ({ page }) => {
	await page.goto(link)
	await page.getByLabel('Name').fill('foo.bar')
	await page.getByLabel('Resolves to address').fill('not-an-address')
	await page.getByRole('button', { name: 'Claim name' }).click()
	await expect(page.getByText(/enter a valid name/i)).toBeVisible()
	await expect(page.getByText(/enter a valid address/i)).toBeVisible()
})

test('the claim form has no axe accessibility violations (a11y)', async ({ page }) => {
	await page.goto(link)
	await expect(page.getByLabel('Name')).toBeVisible()
	const results = await new AxeBuilder({ page }).analyze()
	expect(results.violations).toEqual([])
})
