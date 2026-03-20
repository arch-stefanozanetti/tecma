import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));
const appVersion =
  typeof process.env.VITE_APP_VERSION === "string" && process.env.VITE_APP_VERSION
    ? process.env.VITE_APP_VERSION
    : (pkg?.version ?? "0.0.0");
const proxyTarget =
  typeof process.env.VITE_PROXY_TARGET === "string" && process.env.VITE_PROXY_TARGET
    ? process.env.VITE_PROXY_TARGET
    : "http://localhost:8080";

export default defineConfig({
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
        start_url: "/",
        scope: "/",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
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
    proxy: {
      "/v1": {
        target: proxyTarget,
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
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
