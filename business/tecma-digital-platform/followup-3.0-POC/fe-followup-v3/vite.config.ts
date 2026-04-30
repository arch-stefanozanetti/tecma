import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { readFileSync } from "fs";
import os from "node:os";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));
const appVersion =
  typeof process.env.VITE_APP_VERSION === "string" && process.env.VITE_APP_VERSION
    ? process.env.VITE_APP_VERSION
    : (pkg?.version ?? "0.0.0");
const proxyTarget =
  typeof process.env.VITE_PROXY_TARGET === "string" && process.env.VITE_PROXY_TARGET
    ? process.env.VITE_PROXY_TARGET
    : "http://localhost:8080";
const experimentalEditorProxyTarget =
  typeof process.env.VITE_EXPERIMENTAL_EDITOR_PROXY_TARGET === "string" && process.env.VITE_EXPERIMENTAL_EDITOR_PROXY_TARGET
    ? process.env.VITE_EXPERIMENTAL_EDITOR_PROXY_TARGET
    : "http://localhost:3002";

/** Deploy sotto path (dev-1 multi-canale). Es. `/app/main/` — deve coincidere con rewrite CDN/Render. */
const viteBaseRaw = (process.env.VITE_BASE_PATH ?? "").trim();
const viteBase =
  !viteBaseRaw || viteBaseRaw === "/"
    ? "/"
    : viteBaseRaw.endsWith("/")
      ? viteBaseRaw
      : `${viteBaseRaw}/`;

const manifestIcon = (name: string) =>
  viteBase === "/" ? `/${name}` : `${viteBase.replace(/\/+$/, "")}/${name}`;

const navigateFallback =
  viteBase === "/" ? "/index.html" : `${viteBase.replace(/\/+$/, "")}/index.html`;

/** Vitest carica questo config: VitePWA/workbox può lasciare handle aperti e bloccare exit dopo coverage. */
const runningVitest =
  process.env.VITEST === "true" || process.argv.some((a) => a.includes("vitest") || a.endsWith("/vitest"));
const enablePwa = !runningVitest;

export default defineConfig({
  base: viteBase,
  plugins: [
    react(),
    ...(enablePwa
      ? [
          VitePWA({
            registerType: "prompt",
            injectRegister: null,
            includeAssets: ["apple-touch-icon.svg", "icon-192.png", "icon-512.png", "itd-logo.svg", "offline.html"],
            manifest: {
              name: "Followup 3.0",
              short_name: "Followup",
              description: "CRM Real Estate multi-progetto per agenzie immobiliari",
              theme_color: "#0f172a",
              background_color: "#f8fafc",
              display: "standalone",
              start_url: viteBase,
              scope: viteBase,
              categories: ["business", "productivity"],
              icons: [
                {
                  src: manifestIcon("icon-192.png"),
                  sizes: "192x192",
                  type: "image/png",
                },
                {
                  src: manifestIcon("icon-512.png"),
                  sizes: "512x512",
                  type: "image/png",
                },
                {
                  src: manifestIcon("icon-512.png"),
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "maskable",
                },
              ],
            },
            workbox: {
              /** Bundle principale > 2 MiB (default Workbox); altrimenti la build fallisce in prod (Render). */
              maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
              navigateFallback,
              runtimeCaching: [
                {
                  urlPattern: ({ url }) => url.pathname.startsWith("/v1/"),
                  handler: "NetworkFirst",
                  options: {
                    cacheName: "followup-api",
                    networkTimeoutSeconds: 5,
                    expiration: {
                      maxEntries: 150,
                      maxAgeSeconds: 60 * 60 * 6,
                    },
                  },
                },
                {
                  urlPattern: ({ request }) => request.destination === "script" || request.destination === "style",
                  handler: "StaleWhileRevalidate",
                  options: {
                    cacheName: "followup-static-assets",
                    expiration: {
                      maxEntries: 200,
                      maxAgeSeconds: 60 * 60 * 24 * 7,
                    },
                  },
                },
              ],
            },
          }),
        ]
      : []),
  ],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/mermaid/")) return "vendor-mermaid";
          if (id.includes("/cytoscape") || id.includes("/cose-bilkent")) return "vendor-cytoscape";
          if (id.includes("/katex/")) return "vendor-katex";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/react-router-dom/")) {
            return "vendor-react";
          }
          if (id.includes("/@radix-ui/")) return "vendor-radix";
          if (id.includes("/@mui/") || id.includes("/@emotion/")) return "vendor-mui";
          if (id.includes("/@tiptap/")) return "vendor-editor";
          // recharts / @xyflow: non chunk dedicato — crea ciclo vendor-charts ↔ vendor-react (TDZ in prod).
          if (id.includes("/react-markdown/") || id.includes("/remark-gfm/")) return "vendor-markdown";
          if (id.includes("/date-fns/") || id.includes("/react-day-picker/") || id.includes("/moment/")) {
            return "vendor-dates";
          }
          if (id.includes("/lucide-react/") || id.includes("/simple-icons/")) return "vendor-icons";
          if (id.includes("/posthog-js/")) return "vendor-telemetry";
          if (id.includes("/zod/")) return "vendor-validation";
          // Mai catch-all "vendor-misc": crea cicli vendor-misc ↔ vendor-react / vendor-mermaid e in prod
          // va in crash (`Cannot set properties of undefined (setting 'exports')`). Rollup chunka il resto.
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5177,
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
    proxy: {
      "/v1": {
        target: proxyTarget,
        changeOrigin: true
      },
      "/experimental/editor": {
        target: experimentalEditorProxyTarget,
        changeOrigin: true,
        ws: true,
      }
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    /** threads + max 4: singleFork forks hang dopo ApartmentDetail (mock react-router-dom leak tra file). */
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: Math.min(4, Math.max(1, os.cpus().length)),
      },
    },
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Tutta l’app in report: obiettivo 100% ovunque (vedi docs/PIANO_GLOBALE_FOLLOWUP_3.md §14)
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/test-utils.tsx",
        "**/node_modules/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "**/index.ts",
        "**/*.d.ts",
        "src/types/**",
        "src/data/mockData.ts",
      ],
    },
  },
});
