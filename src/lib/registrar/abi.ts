// The registrar interface the app is coded against, per contracts/registrar-interface.md.
// STATUS: UNVERIFIED — reconcile against the deployed registrar before relying on it (T009a).
export const registrarAbi = [
	{
		type: 'function',
		name: 'whitelist',
		stateMutability: 'view',
		inputs: [{ name: 'account', type: 'address' }],
		outputs: [
			{ name: 'authorized', type: 'bool' },
			{ name: 'used', type: 'bool' }
		]
	},
	{
		type: 'function',
		name: 'available',
		stateMutability: 'view',
		inputs: [{ name: 'label', type: 'string' }],
		outputs: [{ name: '', type: 'bool' }]
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
		name: 'Registered',
		inputs: [
			{ name: 'node', type: 'bytes32', indexed: true },
			{ name: 'label', type: 'string', indexed: false },
			{ name: 'target', type: 'address', indexed: true },
			{ name: 'registrant', type: 'address', indexed: true }
		]
	}
] as const
