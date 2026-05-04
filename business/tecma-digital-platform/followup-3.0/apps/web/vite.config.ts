import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const proxyTarget = (process.env.VITE_PROXY_TARGET ?? '').trim() || 'http://localhost:8080';

/** In dev, se `VITE_API_KEY` non è in apps/web/.env*, usa INTERNAL_API_KEY da services/api (stesso valore richiesto dall’API). */
function readInternalApiKeyFromServicesApi(servicesApiDir: string): string {
  for (const name of ['.env.local', '.env'] as const) {
    const envPath = path.join(servicesApiDir, name);
    if (!existsSync(envPath)) continue;
    const raw = readFileSync(envPath, 'utf8');
    const m = raw.match(/^\s*INTERNAL_API_KEY\s*=\s*(.+)$/m);
    if (m?.[1] == null) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v !== '') return v;
  }
  return '';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const servicesApiDir = path.resolve(__dirname, '../../services/api');
  const fromWeb = (env.VITE_API_KEY ?? '').trim();
  const viteApiKey = fromWeb || readInternalApiKeyFromServicesApi(servicesApiDir);

  return {
    define: {
      'import.meta.env.VITE_API_KEY': JSON.stringify(viteApiKey),
    },
    plugins: [react()],
    server: {
      port: 5177,
      proxy: {
        '/v1': { target: proxyTarget, changeOrigin: true },
      },
      fs: { allow: [path.resolve(__dirname, '..')] },
    },
  };
});
