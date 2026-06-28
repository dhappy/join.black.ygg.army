// The registrar interface the app is coded against, per contracts/registrar-interface.md.
// STATUS: UNVERIFIED — reconcile against the deployed registrar before relying on it (T009a).
//
// `whitelist` is a single mapping(address => uint256) packing a role bitfield in the low byte:
//   bit 0 CLAIMANT(1) bit 1 WHITELISTER(2) bit 2 ADMIN(4) bit 3 SUPERADMIN(8).
// A value >= 2**8 is a redeemed claimant — the value is the block height it was used at. See
// decodeWhitelist in ./reads. 0 is "no permissions" (a mapping can't tell absent from zero).
export const registrarAbi = [
	{
		type: 'function',
		name: 'whitelist',
		stateMutability: 'view',
		inputs: [{ name: 'account', type: 'address' }],
		outputs: [{ name: '', type: 'uint256' }]
	},
	{
		type: 'function',
		name: 'available',
		stateMutability: 'view',
		inputs: [{ name: 'label', type: 'string' }],
		outputs: [{ name: '', type: 'bool' }]
	},
	{
		// Whitelister: mark each account a whitelisted, unused claimant.
		type: 'function',
		name: 'bulkWhitelist',
		stateMutability: 'nonpayable',
		inputs: [{ name: 'accounts', type: 'address[]' }],
		outputs: []
	},
	{
		// Admin: grant each account the whitelister role.
		type: 'function',
		name: 'bulkSetWhitelisters',
		stateMutability: 'nonpayable',
		inputs: [{ name: 'accounts', type: 'address[]' }],
		outputs: []
	},
	{
		// Superadmin: grant each account the admin role.
		type: 'function',
		name: 'bulkSetAdmins',
		stateMutability: 'nonpayable',
		inputs: [{ name: 'accounts', type: 'address[]' }],
		outputs: []
	},
	{
		// Superadmin: grant each account the superadmin role.
		type: 'function',
		name: 'bulkSetSuperadmins',
		stateMutability: 'nonpayable',
		inputs: [{ name: 'accounts', type: 'address[]' }],
		outputs: []
	},
	{
		// Revoke role flags from each account (caller must be able to grant those flags).
		type: 'function',
		name: 'deny',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: 'accounts', type: 'address[]' },
			{ name: 'flags', type: 'uint256' }
		],
		outputs: []
	},
	{
		type: 'function',
		name: 'register',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: 'label', type: 'string' },
			{ name: 'target', type: 'address' },
			{ name: 'signature', type: 'bytes' }
		],
		outputs: []
	},
	{
		type: 'event',
		name: 'Whitelisted',
		inputs: [{ name: 'account', type: 'address', indexed: true }]
	},
	{
		type: 'event',
		name: 'WhitelisterSet',
		inputs: [{ name: 'account', type: 'address', indexed: true }]
	},
	{
		type: 'event',
		name: 'AdminSet',
		inputs: [{ name: 'account', type: 'address', indexed: true }]
	},
	{
		type: 'event',
		name: 'SuperadminSet',
		inputs: [{ name: 'account', type: 'address', indexed: true }]
	},
	{
		type: 'event',
		name: 'Denied',
		inputs: [
			{ name: 'account', type: 'address', indexed: true },
			{ name: 'flags', type: 'uint256', indexed: false }
		]
	},
	{
		type: 'event',
		name: 'Registered',
		inputs: [
			{ name: 'node', type: 'bytes32', indexed: true },
			{ name: 'label', type: 'string', indexed: false },
			{ name: 'target', type: 'address', indexed: true },
			{ name: 'registrant', type: 'address', indexed: true }
		]
	}
] as const
