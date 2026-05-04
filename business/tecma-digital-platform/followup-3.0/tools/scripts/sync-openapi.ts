import { cp, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sourcePath = resolve(process.cwd(), 'services/api/openapi/openapi.v1.yaml');
const mirrorPath = resolve(process.cwd(), 'docs/openapi/openapi.v1.yaml');
const gatewayPath = resolve(process.cwd(), 'infra/aws-api-gateway/additions-followup.yaml');

const run = async (): Promise<void> => {
  await cp(sourcePath, mirrorPath);
  const source = await readFile(sourcePath, 'utf8');
  const header = '# Auto-generated from services/api/openapi/openapi.v1.yaml\n';
  await writeFile(gatewayPath, `${header}${source}`, 'utf8');
  await writeFile(
    resolve(dirname(gatewayPath), 'README.md'),
    'Run `pnpm turbo run openapi:generate --filter=@followup/api` then `tsx tools/scripts/sync-openapi.ts`.',
    'utf8',
  );
};

void run();
