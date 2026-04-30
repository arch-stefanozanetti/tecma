/// <reference types="vite/client" />

declare module "*.md?raw" {
  const content: string;
  export default content;
}

declare module "virtual:pwa-register" {
  export function registerSW(options?: {
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisterError?: (error: unknown) => void;
  }): (reloadPage?: boolean) => Promise<void>;
}

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  /** Dev-1: mostra tendina canali che legge `/channels.json` (o `VITE_CHANNELS_MANIFEST_URL`). */
  readonly VITE_SHOW_DEV_CHANNEL_PICKER?: string;
  /** URL manifest canali (default `/channels.json`). */
  readonly VITE_CHANNELS_MANIFEST_URL?: string;
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
  /**
   * URL Git (senza slash finale) fino alla root monorepo followup-3.0, es.
   * `https://github.com/org/repo/blob/main/path/followup-3.0` — per aprire i link .md dalla Panoramica strategica.
   */
  readonly VITE_FOLLOWUP_DOCS_BASE_URL?: string;
  /** PostHog project API key (pubblico). Se assente, la telemetry prodotto è disattivata. */
  readonly VITE_PUBLIC_POSTHOG_KEY?: string;
  /** Host PostHog EU (default https://eu.i.posthog.com). */
  readonly VITE_PUBLIC_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
