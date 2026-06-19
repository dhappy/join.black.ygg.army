import { env } from '$env/dynamic/public';

// Public, build-time configuration. Never put secrets here — everything is shipped to the client.
export interface AppConfig {
	chainId: number;
	rpcUrl: string;
	registrarAddress: string;
	postfix: string;
	registrarName: string;
	registrarVersion: string;
	entryPointAddress: string;
	bundlerUrl: string;
	paymasterUrl: string;
}

const REQUIRED_KEYS = [
	'PUBLIC_CHAIN_ID',
	'PUBLIC_RPC_URL',
	'PUBLIC_REGISTRAR_ADDRESS',
	'PUBLIC_POSTFIX',
	'PUBLIC_REGISTRAR_NAME',
	'PUBLIC_REGISTRAR_VERSION',
	'PUBLIC_ENTRYPOINT_ADDRESS',
	'PUBLIC_BUNDLER_URL',
	'PUBLIC_PAYMASTER_URL'
] as const;

export function missingConfigKeys(): string[] {
	return REQUIRED_KEYS.filter((key) => !env[key]);
}

export function loadConfig(): AppConfig {
	const missing = missingConfigKeys();
	if (missing.length > 0) throw new Error(`Missing required public config: ${missing.join(', ')}`);
	// Safe: loadConfig throws above if any required key is missing.
	return {
		chainId: Number(env.PUBLIC_CHAIN_ID),
		rpcUrl: env.PUBLIC_RPC_URL!,
		registrarAddress: env.PUBLIC_REGISTRAR_ADDRESS!,
		postfix: env.PUBLIC_POSTFIX!,
		registrarName: env.PUBLIC_REGISTRAR_NAME!,
		registrarVersion: env.PUBLIC_REGISTRAR_VERSION!,
		entryPointAddress: env.PUBLIC_ENTRYPOINT_ADDRESS!,
		bundlerUrl: env.PUBLIC_BUNDLER_URL!,
		paymasterUrl: env.PUBLIC_PAYMASTER_URL!
	};
}
