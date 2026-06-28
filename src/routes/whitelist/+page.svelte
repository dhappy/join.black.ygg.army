<script lang="ts">
	import type { Address } from 'viem'
	import { loadConfig } from '$lib/chain/config'
	import { activeChainId } from '$lib/chain/active.svelte'
	import { explorerTxUrl } from '$lib/chain/explorer'
	import { connectWallet, type Connection } from '$lib/admin/wallet'
	import { runAction } from '$lib/admin/whitelist'
	import { canPerform, WHITELIST_ACTIONS, type WhitelistAction } from '$lib/admin/actions'
	import { readWhitelist, type WhitelistStatus } from '$lib/registrar/reads'
	import Prompt from '$lib/components/Prompt.svelte'
	import ContractStat from '$lib/components/ContractStat.svelte'
	import WhitelistForm from '$lib/components/WhitelistForm.svelte'

	type Phase = 'idle' | 'connecting' | 'ready' | 'submitting' | 'done' | 'error'

	let phase = $state<Phase>('idle')
	let connection = $state<Connection | null>(null)
	let role = $state<WhitelistStatus | null>(null)
	// Config is derived so a chain switch updates the display + explorer links.
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

	let actionId = $state(WHITELIST_ACTIONS[0].id)
	let error = $state('')
	let txHash = $state<`0x${string}` | null>(null)
	let count = $state(0)
	let doneAction = $state<WhitelistAction | null>(null)

	const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
	const action = $derived(WHITELIST_ACTIONS.find((a) => a.id === actionId) ?? WHITELIST_ACTIONS[0])
	const allowed = $derived(canPerform(role, action))
	const roleLabel = $derived(
		!role ? 'unknown' :
		role.isSuperadmin ? 'superadmin' :
		role.isAdmin ? 'admin' :
		role.isWhitelister ? 'whitelister' :
		'no role',
	)
	const txUrl = $derived(txHash ? explorerTxUrl(chainId, txHash, explorerBase) : null)
	const tone = $derived(phase === 'done' ? 'ok' : phase === 'error' ? 'deny' : 'work')

	// Reset the wallet connection when the target chain changes — the connected client is bound to
	// the old network; reconnecting re-runs the chain switch/add prompt on the new one.
	let lastChain = 0
	$effect(() => {
		const id = activeChainId()
		if(lastChain && lastChain !== id && connection) {
			connection = null
			role = null
			phase = 'idle'
			error = ''
		}
		lastChain = id
	})

	async function connect() {
		error = ''
		phase = 'connecting'
		try {
			connection = await connectWallet()
			role = await readWhitelist(connection.account)
			phase = 'ready'
		} catch (e) {
			error = connectError(e)
			phase = 'idle'
		}
	}

	async function submit(addresses: Address[]) {
		if (!connection) return
		error = ''
		phase = 'submitting'
		try {
			const result = await runAction(connection.client, connection.account, action, addresses)
			txHash = result.txHash
			count = addresses.length
			doneAction = action
			role = await readWhitelist(connection.account) // refresh in case the wallet changed its own role
			phase = 'done'
		} catch (e) {
			error = submitError(e)
			phase = 'error'
		}
	}

	function reset() {
		txHash = null
		count = 0
		doneAction = null
		error = ''
		phase = connection ? 'ready' : 'idle'
	}

	function connectError(e: unknown): string {
		const msg = e instanceof Error ? e.message : ''
		if (msg === 'NoWallet') return 'No injected wallet found. Use Frame (Companion extension), MetaMask, Rabby or similar.'
		if (msg === 'NoAccount') return 'No account was shared by the wallet.'
		return 'Could not connect the wallet (request rejected or wrong network).'
	}

	function submitError(e: unknown): string {
		const msg = e instanceof Error ? e.message : ''
		if (msg === 'EmptyList') return 'Nothing to submit — add at least one valid address.'
		if (/user rejected|denied/i.test(msg)) return 'Transaction rejected in the wallet.'
		return 'The transaction failed — this account may lack the required role.'
	}
</script>

<Prompt {postfix} meta="admin // roles" />

<main class="cp-stage cp-stage--wide">
	<section class="cp-console">
		<p class="cp-eyebrow" data-tone={tone}>
			<span>admin // whitelist &amp; roles</span>
		</p>

		<h1 class="cp-title">Manage access</h1>

		{#if phase === 'done' && doneAction}
			<p class="cp-body">
				{doneAction.verb === 'grant' ? 'Granted' : 'Revoked'}
				<b>{doneAction.label.replace(/^(Whitelist|Add|Revoke) /, '').replace(/s$/, '')}</b>
				{doneAction.verb === 'grant' ? 'to' : 'from'}
				<b>{count}</b> {count === 1 ? 'address' : 'addresses'}.
			</p>
			<div class="cp-tx">
				<span>transaction</span>
				{#if txUrl}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve external block-explorer URL, not a SvelteKit route -->
					<a href={txUrl} target="_blank" rel="noopener noreferrer">{txHash}</a>
				{:else}
					<code>{txHash}</code>
				{/if}
			</div>
			<button class="cp-btn cp-btn--ghost" type="button" onclick={reset}>Do more</button>
		{:else}
			<p class="cp-body">
				Connect a wallet, pick an action, paste the addresses, and apply it in one transaction. You
				pay gas. Actions you lack the role for are disabled.
			</p>

			{#if !connection}
				<button class="cp-btn" type="button" onclick={connect} disabled={phase === 'connecting'}>
					{phase === 'connecting' ? 'Connecting…' : 'Connect wallet'}
				</button>
			{:else}
				<dl class="cp-tally">
					<div><dt>connected</dt><dd>{short(connection.account)}</dd></div>
					<div>
						<dt>role</dt>
						<dd class={role && role.isWhitelister && !role.used ? 'cp-tally--ok' : 'cp-tally--bad'}>
							{roleLabel}
						</dd>
					</div>
				</dl>

				<div class="cp-field">
					<label for="wl-action">Action</label>
					<span class="cp-input-wrap">
						<select class="cp-input cp-select" id="wl-action" bind:value={actionId}>
							<optgroup label="Grant">
								{#each WHITELIST_ACTIONS.filter((a) => a.verb === 'grant') as a (a.id)}
									<option value={a.id} disabled={!canPerform(role, a)}>{a.label}</option>
								{/each}
							</optgroup>
							<optgroup label="Revoke">
								{#each WHITELIST_ACTIONS.filter((a) => a.verb === 'revoke') as a (a.id)}
									<option value={a.id} disabled={!canPerform(role, a)}>{a.label}</option>
								{/each}
							</optgroup>
						</select>
					</span>
					<p class="cp-hint">{action.blurb}</p>
				</div>

				{#if !allowed}
					<div class="cp-alert cp-alert--warn">
						<div>
							<p>
								This wallet ({roleLabel}) can't perform “{action.label}” — that needs a higher role,
								so the transaction would revert. Pick another action or switch accounts.
							</p>
						</div>
					</div>
				{/if}

				<WhitelistForm onsubmit={submit} submitLabel={action.label} busy={phase === 'submitting'} disabled={!allowed} />
			{/if}

			{#if error}
				<div class="cp-alert cp-alert--deny">
					<div><p role="alert">{error}</p></div>
				</div>
			{/if}
		{/if}
	</section>
</main>

<footer class="cp-statusbar">
	<span class="cp-stat">mode <b>admin</b></span>
	<span class="cp-prompt__spacer"></span>
	{#if connection}<span class="cp-stat">wallet <b>{short(connection.account)}</b></span>{/if}
	<ContractStat />
	<span class="cp-stat">chain <b>{chainId || '—'}</b></span>
	<span class="cp-stat cp-stat--gas">gas <b>self-paid</b></span>
</footer>
