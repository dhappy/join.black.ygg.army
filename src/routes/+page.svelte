<script lang="ts">
	import { onMount } from 'svelte'
	import type { Address } from 'viem'
	import { parseClaimLink, stripFragment, type ParsedClaimLink } from '$lib/claim/link'
	import { createClaimSession } from '$lib/claim/session.svelte'
	import { readWhitelist } from '$lib/registrar/reads'
	import { registerName } from '$lib/claim/register'
	import { normalizeLabel } from '$lib/ens/normalize'
	import { validateAddress } from '$lib/ens/address'
	import { loadConfig } from '$lib/chain/config'
	import { activeChainId } from '$lib/chain/active.svelte'
	import { explorerTxUrl } from '$lib/chain/explorer'
	import type { ClaimState, ErrorCategory } from '$lib/claim/state'
	import StatusBanner from '$lib/components/StatusBanner.svelte'
	import ClaimForm from '$lib/components/ClaimForm.svelte'
	import SuccessCard from '$lib/components/SuccessCard.svelte'
	import LinkState from '$lib/components/LinkState.svelte'
	import ErrorAlert from '$lib/components/ErrorAlert.svelte'
	import RootKey from '$lib/components/RootKey.svelte'
	import StateIcon from '$lib/components/StateIcon.svelte'

	const session = createClaimSession()
	let parsed = $state<ParsedClaimLink | null>(null)

	// Config is derived so a chain switch re-resolves postfix / chain id / explorer base.
	const cfg = $derived.by(() => {
		try {
			return loadConfig()
		} catch {
			return null
		}
	})
	const postfix = $derived(cfg?.postfix ?? '')
	const chainId = $derived(cfg?.chainId ?? 1)
	const explorerBase = $derived(cfg?.explorerUrl)

	const titles: Record<ClaimState['kind'], string> = {
		LoadingLink: 'Verifying invitation',
		CheckingWhitelist: 'Verifying invitation',
		MissingKey: 'No invitation key',
		InvalidLink: 'Invalid invitation',
		NotAuthorized: 'Not on the allow-list',
		AlreadyRedeemed: 'Invitation spent',
		Ready: 'Claim your name',
		Submitting: 'Registering',
		Pending: 'Registering',
		Success: 'Name claimed',
		Failed: 'Registration failed',
	}
	const denied = ['MissingKey', 'InvalidLink', 'NotAuthorized', 'AlreadyRedeemed', 'Failed']
	const tone = $derived(
		session.state.kind === 'Success' ? 'ok' : denied.includes(session.state.kind) ? 'deny' : 'work',
	)
	const signer = $derived('signer' in session.state ? session.state.signer : null)
	const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

	onMount(() => {
		const link = parseClaimLink(window.location.hash)
		history.replaceState(null, '', stripFragment(window.location.href))
		parsed = link
	})

	// Resolve the link against the active chain, and re-resolve on a chain switch — the same signer
	// may be whitelisted on one deployment but not another.
	$effect(() => {
		activeChainId() // dependency: re-run when the target chain changes
		const link = parsed
		if(!link) return
		session.fromLink(link)
		if(link.ok) void resolve(link.signerAddress)
	})

	async function resolve(signerAddress: Address) {
		try {
			const whitelist = await readWhitelist(signerAddress)
			session.resolveWhitelist(signerAddress, whitelist)
		} catch {
			session.failed(signerAddress, 'SubmissionFailed')
		}
	}

	async function submit(label: string, address: string) {
		const current = session.state
		const key = session.privateKey
		if (current.kind !== 'Ready' || !key) return
		const normalized = normalizeLabel(label)
		const target = validateAddress(address)
		if (!normalized.ok || !target.ok) return
		const signerAddress = current.signer
		session.submitting(signerAddress)
		try {
			const result = await registerName({
				privateKey: key,
				label: normalized.normalized,
				target: target.address,
			})
			session.succeeded(result.fqName, target.address, result.txHash)
		} catch (error) {
			const category: ErrorCategory =
				error instanceof Error && error.message === 'NameTaken' ? 'NameTaken' : 'SubmissionFailed'
			session.failed(signerAddress, category)
		}
	}
</script>

<header class="cp-prompt">
	<svg class="cp-prompt__sigil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
		<path d="M3 21 L21 3 M14 3 L21 3 L21 10" />
		<circle cx="7.5" cy="16.5" r="3.5" />
	</svg>
	<span class="cp-prompt__path">join.<b>{postfix || 'black.ygg.army'}</b></span>
	<span class="cp-prompt__spacer"></span>
	<span class="cp-prompt__meta">one-time claim</span>
</header>

<main class="cp-stage">
	<div class="cp-spine">
		<RootKey kind={session.state.kind} />
	</div>

	<section class="cp-console">
		<p class="cp-eyebrow" data-tone={tone}>
			<StateIcon kind={session.state.kind} class="cp-icon" />
			<span>status // {tone === 'ok' ? 'verified' : tone === 'deny' ? 'halted' : 'live'}</span>
		</p>

		<h1 class="cp-title">{titles[session.state.kind]}</h1>

		{#if session.state.kind === 'LoadingLink' || session.state.kind === 'CheckingWhitelist'}
			<p class="cp-working">Reading the invitation key…</p>
		{:else if session.state.kind === 'MissingKey' || session.state.kind === 'InvalidLink' || session.state.kind === 'NotAuthorized' || session.state.kind === 'AlreadyRedeemed'}
			<LinkState state={session.state} />
		{:else if session.state.kind === 'Ready'}
			<p class="cp-body">
				Choose your handle under <b>.{postfix}</b>. Gas is sponsored — you pay nothing.
			</p>
			<ClaimForm onsubmit={submit} {postfix} />
		{:else if session.state.kind === 'Submitting' || session.state.kind === 'Pending'}
			<p class="cp-working">Signing &amp; registering — gas sponsored…</p>
		{:else if session.state.kind === 'Success'}
			<SuccessCard
				{...session.state}
				explorerUrl={explorerTxUrl(chainId, session.state.txHash, explorerBase)}
			/>
		{:else if session.state.kind === 'Failed'}
			<ErrorAlert error={session.state.error} onretry={() => session.retry()} />
		{/if}
	</section>
</main>

<footer class="cp-statusbar">
	<StatusBanner state={session.state} />
	<span class="cp-prompt__spacer"></span>
	{#if signer}<span class="cp-stat">signer <b>{short(signer)}</b></span>{/if}
	<span class="cp-stat">chain <b>{chainId || '—'}</b></span>
	<span class="cp-stat cp-stat--gas">gas <b>sponsored</b></span>
</footer>
