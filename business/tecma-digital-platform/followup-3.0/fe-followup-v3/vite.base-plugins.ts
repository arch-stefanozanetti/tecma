/**
 * Plugin condivisi tra vite.config e vitest.*.config.
 * vite-tsconfig-paths applica i `paths` di tsconfig.json a Vite (stessa risoluzione di tsc).
 */
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import type { PluginOption } from "vite";

export function baseVitePlugins(): PluginOption[] {
  return [react(), tsconfigPaths()];
}
