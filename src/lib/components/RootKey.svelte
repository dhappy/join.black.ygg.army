<script lang="ts">
	import type { ClaimState } from '$lib/claim/state'

	let { kind }: { kind: ClaimState['kind'] } = $props()

	// The signature element: a cryptographic root tree (the namespace) growing from a key-seed.
	// Its mode encodes the claim's trust state; the claimed leaf is the second of four.
	const mode = $derived(
		kind === 'Success'
			? 'ok'
			: kind === 'InvalidLink' ||
					kind === 'NotAuthorized' ||
					kind === 'AlreadyRedeemed' ||
					kind === 'Failed'
				? 'deny'
				: 'work',
	)
</script>

<svg
	class="rk"
	data-mode={mode}
	viewBox="0 0 240 520"
	role="img"
	aria-label="Yggdrasil root-key — {mode === 'ok' ? 'claimed' : mode === 'deny' ? 'inactive' : 'awaiting claim'}"
>
	<!-- fingerprint ruler -->
	<g class="rk-ruler" font-family="ui-monospace, monospace" font-size="9" letter-spacing="1.5">
		<line x1="20" y1="70" x2="20" y2="400" stroke-dasharray="1 7" />
		<text x="28" y="96">ed25519</text>
		<text x="28" y="180">9f:3a:c1</text>
		<text x="28" y="264">07:e8:5b</text>
		<text x="28" y="348">d4:2a:6f</text>
	</g>

	<!-- branches -->
	<g class="rk-stroke" fill="none" stroke-linecap="round">
		<path class="rk-trunk" d="M120 86 L120 156" />
		<path class="rk-l1" d="M120 156 L70 238 M120 156 L170 238" />
		<path class="rk-l2" d="M70 238 L40 348 M70 238 L100 348 M170 238 L140 348 M170 238 L200 348" />
	</g>

	<!-- key-seed (namespace root) -->
	<g class="rk-seed">
		<path
			class="rk-hex"
			d="M120 30 L150 48 L150 84 L120 102 L90 84 L90 48 Z"
			fill="none"
			stroke-width="2"
		/>
		<circle class="rk-keyhole" cx="120" cy="60" r="8" fill="none" stroke-width="2" />
		<line class="rk-keyhole" x1="120" y1="66" x2="120" y2="80" stroke-width="2" />
	</g>

	<!-- junction nodes -->
	<circle class="rk-node" cx="70" cy="238" r="4" />
	<circle class="rk-node" cx="170" cy="238" r="4" />

	<!-- leaves; index 1 is the claimed name -->
	<circle class="rk-leaf" cx="40" cy="348" r="5" />
	<g class="rk-claim">
		<circle cx="100" cy="348" r="7" />
		<rect x="92" y="362" width="16" height="10" rx="1" />
	</g>
	<circle class="rk-leaf" cx="140" cy="348" r="5" />
	<circle class="rk-leaf" cx="200" cy="348" r="5" />
</svg>

<style>
	.rk {
		--c: var(--phosphor);
		overflow: visible;
	}
	.rk[data-mode='deny'] {
		--c: #3c5b4d;
	}
	.rk[data-mode='ok'] {
		--c: var(--phosphor);
	}

	.rk-ruler line {
		stroke: var(--line);
	}
	.rk-ruler text {
		fill: var(--label);
		opacity: 0.55;
	}

	.rk-stroke path,
	.rk-seed .rk-hex,
	.rk-keyhole {
		stroke: var(--c);
	}
	.rk-node,
	.rk-leaf {
		fill: var(--c);
	}

	/* draw-in */
	.rk-trunk,
	.rk-l1,
	.rk-l2,
	.rk-hex {
		stroke-dasharray: 360;
		stroke-dashoffset: 360;
		animation: cp-draw 1.1s ease forwards;
	}
	.rk-l1 {
		animation-delay: 0.5s;
	}
	.rk-l2 {
		animation-delay: 0.9s;
	}
	.rk-seed .rk-hex {
		filter: drop-shadow(var(--glow-phos));
	}

	/* claimed leaf */
	.rk-claim circle {
		fill: var(--amber);
		filter: drop-shadow(0 0 10px rgba(246, 192, 99, 0.5));
		animation: cp-blink 1.8s ease-in-out infinite;
	}
	.rk-claim rect {
		fill: none;
		stroke: var(--amber);
		stroke-width: 1.5;
	}
	.rk[data-mode='ok'] .rk-claim circle {
		fill: var(--verified);
		filter: drop-shadow(var(--glow-ver));
		animation: none;
	}
	.rk[data-mode='ok'] .rk-claim rect {
		stroke: var(--verified);
	}
	.rk[data-mode='deny'] .rk-claim circle {
		fill: var(--alarm);
		filter: none;
		animation: none;
	}
	.rk[data-mode='deny'] .rk-claim rect {
		stroke: var(--alarm);
	}
	.rk[data-mode='deny'] .rk-leaf,
	.rk[data-mode='deny'] .rk-node {
		opacity: 0.4;
	}
</style>
