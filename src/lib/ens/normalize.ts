import { ens_normalize } from '@adraffy/ens-normalize'

// Validate a single label with ENSIP-15 normalization (clarify Q4 / FR-003). The normalized form
// is what gets signed and registered, so callers should use it rather than the raw input.
export type NormalizedLabel =
	| { ok: true, normalized: string }
	| { ok: false }

export function normalizeLabel(input: string): NormalizedLabel {
	let normalized: string
	try {
		normalized = ens_normalize(input)
	} catch {
		return { ok: false }
	}
	// A claim is a single label under the fixed postfix — no empty labels, no embedded dots.
	if (normalized.length === 0 || normalized.includes('.')) return { ok: false }
	return { ok: true, normalized }
}

export function fullyQualifiedName(label: string, postfix: string): string {
	return `${label}.${postfix}`
}

// The fully-qualified preview shown to the claimant before submission, or '' when the label is
// empty or does not normalize (FR-003).
export function previewName(label: string, postfix: string): string {
	if (label.length === 0) return ''
	const result = normalizeLabel(label)
	return result.ok ? fullyQualifiedName(result.normalized, postfix) : ''
}
