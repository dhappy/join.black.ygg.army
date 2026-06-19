<script lang="ts">
	import type { ClaimState } from '$lib/claim/state';

	let { state }: { state: ClaimState } = $props();

	const text: Partial<Record<ClaimState['kind'], string>> = {
		InvalidLink: 'This invitation link is invalid or incomplete. Please check the link you were given.',
		NotAuthorized: 'This link is not on the allow-list, so it cannot be used to register a name.',
		AlreadyRedeemed: 'This invitation has already been used to register a name.'
	};
</script>

<section role="alert">
	<p>{text[state.kind] ?? 'This link cannot be used.'}</p>
</section>
