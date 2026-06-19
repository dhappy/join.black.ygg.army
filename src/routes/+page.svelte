<script lang="ts">
	import { onMount } from 'svelte'
	import { parseClaimLink, stripFragment } from '$lib/claim/link'
	import { createClaimSession } from '$lib/claim/session.svelte'
	import { readWhitelist } from '$lib/registrar/reads'
	import { registerName } from '$lib/claim/register'
	import { normalizeLabel } from '$lib/ens/normalize'
	import { validateAddress } from '$lib/ens/address'
	import { loadConfig } from '$lib/chain/config'
	import type { ErrorCategory } from '$lib/claim/state'
	import StatusBanner from '$lib/components/StatusBanner.svelte'
	import ClaimForm from '$lib/components/ClaimForm.svelte'
	import SuccessCard from '$lib/components/SuccessCard.svelte'
	import LinkState from '$lib/components/LinkState.svelte'
	import ErrorAlert from '$lib/components/ErrorAlert.svelte'

	const session = createClaimSession()
	let postfix = $state('')

	onMount(async () => {
		try {
			postfix = loadConfig().postfix
		} catch {
			postfix = ''
		}
		const parsed = parseClaimLink(window.location.hash)
		history.replaceState(null, '', stripFragment(window.location.href))
		session.fromLink(parsed)
		if (parsed.ok) {
			try {
				const whitelist = await readWhitelist(parsed.signerAddress)
				session.resolveWhitelist(parsed.signerAddress, whitelist)
			} catch {
				session.failed(parsed.signerAddress, 'SubmissionFailed')
			}
		}
	})

	async function submit(label: string, address: string) {
		const current = session.state
		const key = session.privateKey
		if (current.kind !== 'Ready' || !key) return
		const normalized = normalizeLabel(label)
		const target = validateAddress(address)
		if (!normalized.ok || !target.ok) return
		const signer = current.signer
		session.submitting(signer)
		try {
			const result = await registerName({
				privateKey: key,
				label: normalized.normalized,
				target: target.address
			})
			session.succeeded(result.fqName, target.address, result.txHash)
		} catch (error) {
			const category: ErrorCategory =
				error instanceof Error && error.message === 'NameTaken' ? 'NameTaken' : 'SubmissionFailed'
			session.failed(signer, category)
		}
	}
</script>

<main>
	<h1>Claim your name</h1>
	<StatusBanner state={session.state} />

	{#if session.state.kind === 'LoadingLink' || session.state.kind === 'CheckingWhitelist'}
		<p>Checking your invitation…</p>
	{:else if session.state.kind === 'InvalidLink' || session.state.kind === 'NotAuthorized' || session.state.kind === 'AlreadyRedeemed'}
		<LinkState state={session.state} />
	{:else if session.state.kind === 'Ready'}
		<ClaimForm onsubmit={submit} {postfix} />
	{:else if session.state.kind === 'Submitting' || session.state.kind === 'Pending'}
		<p aria-live="polite">Registering your name…</p>
	{:else if session.state.kind === 'Success'}
		<SuccessCard fqName={session.state.fqName} target={session.state.target} />
	{:else if session.state.kind === 'Failed'}
		<ErrorAlert error={session.state.error} onretry={() => session.retry()} />
	{/if}
</main>
