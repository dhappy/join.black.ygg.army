import { expect, test } from '@playwright/test'
import { hexToBytes } from 'viem'
import { toBase64Url } from '../src/lib/claim/link'

// These run against the Anvil-backed dev server (scripts/e2e-server.mjs), which whitelists the
// "ready" and "used" keys and consumes the "used" one. The outsider key is never whitelisted.
const USED = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
const OUTSIDER = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'

function link(hexKey: `0x${string}`): string {
	return `/#k=${toBase64Url(hexToBytes(hexKey))}`
}

test('a non-whitelisted link shows NotAuthorized (US2)', async ({ page }) => {
	await page.goto(link(OUTSIDER))
	await expect(page.getByRole('alert')).toContainText(/allow-list/i)
})

test('an already-redeemed link shows AlreadyRedeemed (US2)', async ({ page }) => {
	await page.goto(link(USED))
	await expect(page.getByRole('alert')).toContainText(/already been used/i)
})
