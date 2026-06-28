<script lang="ts">
	import { resolve } from '$app/paths'

	let { postfix, meta }: { postfix: string, meta: string } = $props()
</script>

<header class="cp-prompt">
	<svg class="cp-prompt__sigil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
		<path d="M3 21 L21 3 M14 3 L21 3 L21 10" />
		<circle cx="7.5" cy="16.5" r="3.5" />
	</svg>
	<span class="cp-prompt__path"><a href={resolve('/')}>join</a>.<b>{postfix || 'black.ygg.army'}</b></span>
	<span class="cp-prompt__spacer"></span>
	<span class="cp-prompt__meta">{meta}</span>
</header>

<style>
	a {
		color: inherit;
		text-decoration: none;

		&:hover {
			color: var(--phosphor);
			text-decoration: underline;
		}
	}
</style>
