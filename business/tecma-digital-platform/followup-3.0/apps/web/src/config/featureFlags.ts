const flagFromEnv = (rawValue: string | undefined, defaultValue: boolean): boolean => {
  const normalized = (rawValue ?? '').toString().trim().toLowerCase();
  if (normalized === '') return defaultValue;
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

export const ENABLE_NEW_SESSION_FLOW = flagFromEnv(
  import.meta.env.VITE_ENABLE_NEW_SESSION_FLOW as string | undefined,
  true,
);

/**
 * Abilita upload asset workspace via signed URL (M2). Default OFF in dev/prod
 * fino a quando lo storage non e provisionato; il backend espone comunque le
 * route con fallback inline base64 per dev/test.
 */
export const ENABLE_ASSET_UPLOADS = flagFromEnv(
  import.meta.env.VITE_ENABLE_ASSET_UPLOADS as string | undefined,
  false,
);
