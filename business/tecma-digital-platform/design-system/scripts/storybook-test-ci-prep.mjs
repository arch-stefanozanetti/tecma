import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** File dummy per Node 22+ / 25: evita SecurityError su localStorage in jest-environment-node (test-runner). */
const dir = join(process.cwd(), "node_modules", ".cache");
const file = join(dir, "storybook-test-localstorage");
mkdirSync(dir, { recursive: true });
writeFileSync(file, "");
