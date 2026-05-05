export type SessionStorageStrategy = 'auth-only' | 'full';

export type SessionInvalidationReason =
  | 'session_expired'
  | 'invalid_token'
  | 'missing_token'
  | 'insufficient_auth'
  | 'tenant_mismatch'
  | 'maintenance'
  | 'network_error'
  | 'server_error'
  | 'manual_logout'
  | 'token_precheck'
  | 'unknown';

export type SessionInvalidationSource =
  | 'api_interceptor'
  | 'project_access'
  | 'logout'
  | 'bootstrap'
  | 'cross_tab'
  | 'manual';

export type SessionInvalidationOptions = {
  reason: SessionInvalidationReason;
  source: SessionInvalidationSource;
  redirectToLogin?: boolean;
  strategy?: SessionStorageStrategy;
  writeMarker?: boolean;
};

export type SessionInvalidationEvent = {
  reason: SessionInvalidationReason;
  source: SessionInvalidationSource;
  redirectToLogin: boolean;
  at: string;
};

export type SessionInvalidationMarker = SessionInvalidationEvent & {
  markerId: string;
};
