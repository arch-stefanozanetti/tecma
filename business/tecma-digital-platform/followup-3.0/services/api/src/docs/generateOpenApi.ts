import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

import { stringify } from 'yaml';

import { buildServer } from '../server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const run = async (): Promise<void> => {
  process.env.OPENAPI_GENERATE = '1';
  const app = await buildServer();
  await app.ready();
  const spec = await app.swagger();

  const outDir = path.resolve(__dirname, '../../openapi');
  await mkdir(outDir, { recursive: true });
  const target = path.join(outDir, 'openapi.v1.yaml');
  await writeFile(target, stringify(spec, { lineWidth: 120 }), 'utf8');

  await app.close();
};

void run();
