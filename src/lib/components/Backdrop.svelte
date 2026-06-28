<script lang="ts">
	// Decorative ambient field: a faint triangular grid + slowly drifting key-fingerprint hex.
	// Purely decorative — hidden from assistive tech, non-interactive. Deterministic (no Math.random)
	// so prerender and hydration match.
	const columns = [
		{ x: 80, dur: 26, hex: ['9f', '3a', 'c1', '07', 'e8', '5b', 'd4', '2a', '6f', 'b0', '1c', '77', '4e', 'a3'] },
		{ x: 360, dur: 34, hex: ['12', 'bd', '6c', 'f0', '29', '8a', 'e1', '47', 'd9', '3f', 'b5', '08', 'cc', '91'] },
		{ x: 720, dur: 30, hex: ['a4', '5e', '0d', 'f7', '63', 'b8', '1a', 'e2', '7c', '95', '38', 'd0', '4b', 'ff'] },
		{ x: 1040, dur: 38, hex: ['e6', '2f', 'c8', '71', '0a', 'bf', '53', '9d', '46', 'da', '17', 'a9', '60', 'cb'] },
	]
</script>

<svg class="cp-backdrop" aria-hidden="true" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1200 800">
	<defs>
		<pattern id="cp-grid" width="56" height="48" patternUnits="userSpaceOnUse" patternTransform="skewX(-18)">
			<path d="M0 48 L28 0 L56 48 M-28 0 L0 48 M28 0 L56 48" fill="none" stroke="#15201b" stroke-width="1" />
		</pattern>
		<radialGradient id="cp-fade" cx="50%" cy="0%" r="90%">
			<stop offset="0%" stop-color="#0a1310" />
			<stop offset="100%" stop-color="#05080a" />
		</radialGradient>
	</defs>

	<rect width="1200" height="800" fill="url(#cp-fade)" />
	<rect width="1200" height="800" fill="url(#cp-grid)" opacity="0.6" />

	{#each columns as col (col.x)}
		<g
			class="cp-drift"
			transform="translate({col.x} 0)"
			style="animation: cp-drift {col.dur}s linear infinite; transform-box: fill-box;"
		>
			{#each col.hex as h, i (i)}
				<text
					x="0"
					y={48 + i * 64}
					font-family="ui-monospace, monospace"
					font-size="18"
					letter-spacing="2"
					fill="#173a2b"
				>{h}</text>
			{/each}
		</g>
	{/each}
</svg>
