/// <reference types="vite/client" />

declare module "virtual:pwa-register" {
  export function registerSW(options?: {
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisterError?: (error: unknown) => void;
  }): (reloadPage?: boolean) => Promise<void>;
}

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_USE_BSS_AUTH?: string;
  readonly VITE_BUCKET_BASEURL?: string;
  readonly VITE_BUSINESSPLATFORM_LOGIN?: string;
  /** OIDC Keycloak (client pubblico + PKCE). Se valorizzati, il pulsante SSO usa Keycloak invece della BusinessPlatform. */
  readonly VITE_KEYCLOAK_URL?: string;
  readonly VITE_KEYCLOAK_REALM?: string;
  readonly VITE_KEYCLOAK_CLIENT_ID?: string;
  /** Scope OIDC (default: openid email profile) */
  readonly VITE_KEYCLOAK_SCOPE?: string;
  /** Path assoluto sulla stessa origine del FE (default: /login/keycloak-callback). Deve coincidere con Valid Redirect URIs in Keycloak. */
  readonly VITE_KEYCLOAK_REDIRECT_PATH?: string;
  readonly VITE_FORGOT_CREDENTIALS_URL?: string;
  readonly VITE_DATA_MODE?: string;
  readonly VITE_GITHUB_RELEASES_REPO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
