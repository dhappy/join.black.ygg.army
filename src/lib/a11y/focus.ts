// Move keyboard focus to the first meaningful element in a container after a state change, so
// screen-reader and keyboard users are not stranded (constitution Principle I).
export function focusFirst(container: HTMLElement | null): void {
	if (!container) return;
	const target = container.querySelector<HTMLElement>('h1, h2, [tabindex], input, button, a[href]');
	target?.focus();
}
