<script lang="ts">
	import type { ClaimState } from '$lib/claim/state'
	import StateIcon from './StateIcon.svelte'

	let { state }: { state: ClaimState } = $props()

	const text: Partial<Record<ClaimState['kind'], string>> = {
		MissingKey: 'This link has no invitation key. Open the full link exactly as you were given it — the part after the # must be present.',
		InvalidLink: 'This invitation link is invalid or incomplete. Please check the link you were given.',
		NotAuthorized: 'This link is not on the allow-list, so it cannot be used to register a name.',
		AlreadyRedeemed: 'This invitation has already been used to register a name.',
	}
</script>

<section class="cp-alert cp-alert--deny" role="alert">
	<StateIcon kind={state.kind} class="cp-icon" />
	<p>{text[state.kind] ?? 'This link cannot be used.'}</p>
</section>
