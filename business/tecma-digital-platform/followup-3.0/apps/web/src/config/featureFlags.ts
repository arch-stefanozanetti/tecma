const fromEnv = (import.meta.env.VITE_ENABLE_NEW_SESSION_FLOW ?? '').toString().trim().toLowerCase();

export const ENABLE_NEW_SESSION_FLOW =
  fromEnv === '' ? true : fromEnv === '1' || fromEnv === 'true' || fromEnv === 'yes';
