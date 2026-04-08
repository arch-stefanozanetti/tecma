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

export default defineConfig({
  base: viteBase,
  plugins: [
    react(),
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
  ],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
    /** Evita RangeError Tinypool (minThreads > maxThreads) su runner con pochi core. */
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
