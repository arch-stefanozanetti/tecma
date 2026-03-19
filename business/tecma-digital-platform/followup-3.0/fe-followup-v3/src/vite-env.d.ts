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
  readonly VITE_FORGOT_CREDENTIALS_URL?: string;
  readonly VITE_DATA_MODE?: string;
  readonly VITE_GITHUB_RELEASES_REPO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
