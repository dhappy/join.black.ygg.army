import { ADMIN, CLAIMANT, SUPERADMIN, WHITELISTER, type WhitelistStatus } from '$lib/registrar/roles'

// One operation the admin UI can perform, mapped to a registrar write. `flag` is the role granted
// or revoked; `requires` is the role the caller must hold to do it (mirrors the contract's
// _canManage: whitelister→CLAIMANT, admin→WHITELISTER, superadmin→ADMIN/SUPERADMIN).
export interface WhitelistAction {
	id: string
	label: string
	verb: 'grant' | 'revoke'
	flag: bigint
	functionName: 'bulkWhitelist' | 'bulkSetWhitelisters' | 'bulkSetAdmins' | 'bulkSetSuperadmins' | 'deny'
	requires: bigint
	blurb: string
}

// The role required to grant or revoke a given flag.
export function requiredRole(flag: bigint): bigint {
	if (flag === CLAIMANT) return WHITELISTER
	if (flag === WHITELISTER) return ADMIN
	return SUPERADMIN // ADMIN or SUPERADMIN
}

export const WHITELIST_ACTIONS: WhitelistAction[] = [
	{ id: 'grant-claimant', label: 'Whitelist claimants', verb: 'grant', flag: CLAIMANT, functionName: 'bulkWhitelist', requires: WHITELISTER, blurb: 'Authorise each address to claim one name.' },
	{ id: 'grant-whitelister', label: 'Add whitelisters', verb: 'grant', flag: WHITELISTER, functionName: 'bulkSetWhitelisters', requires: ADMIN, blurb: 'Let each address whitelist claimants.' },
	{ id: 'grant-admin', label: 'Add admins', verb: 'grant', flag: ADMIN, functionName: 'bulkSetAdmins', requires: SUPERADMIN, blurb: 'Let each address add whitelisters.' },
	{ id: 'grant-superadmin', label: 'Add superadmins', verb: 'grant', flag: SUPERADMIN, functionName: 'bulkSetSuperadmins', requires: SUPERADMIN, blurb: 'Let each address add admins and superadmins.' },
	{ id: 'revoke-claimant', label: 'Revoke claimant', verb: 'revoke', flag: CLAIMANT, functionName: 'deny', requires: WHITELISTER, blurb: 'Remove the claimant role from each address.' },
	{ id: 'revoke-whitelister', label: 'Revoke whitelister', verb: 'revoke', flag: WHITELISTER, functionName: 'deny', requires: ADMIN, blurb: 'Remove the whitelister role from each address.' },
	{ id: 'revoke-admin', label: 'Revoke admin', verb: 'revoke', flag: ADMIN, functionName: 'deny', requires: SUPERADMIN, blurb: 'Remove the admin role from each address.' },
	{ id: 'revoke-superadmin', label: 'Revoke superadmin', verb: 'revoke', flag: SUPERADMIN, functionName: 'deny', requires: SUPERADMIN, blurb: 'Remove the superadmin role from each address.' },
]

// Whether a status holds a given role flag (cumulative: admins/superadmins also hold lower roles).
export function holdsRole(status: WhitelistStatus, role: bigint): boolean {
	if (role === WHITELISTER) return status.isWhitelister
	if (role === ADMIN) return status.isAdmin
	if (role === SUPERADMIN) return status.isSuperadmin
	return false
}

// Whether the connected wallet may perform an action (holds the required role and isn't a spent claimant).
export function canPerform(status: WhitelistStatus | null, action: WhitelistAction): boolean {
	return !!status && !status.used && holdsRole(status, action.requires)
}
