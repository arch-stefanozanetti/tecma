import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const specPath = join(__dirname, '../../openapi/openapi.v1.yaml');
const openApiYamlOptions = {
  // The generated OpenAPI file intentionally reuses the common protected-route security
  // requirement through YAML anchors. The default parser guard is too low for this
  // legitimate generated contract, while still keeping an explicit ceiling here.
  maxAliasCount: 1000,
};

type PathItem = Record<string, unknown>;
type Operation = {
  operationId?: string;
  security?: unknown[];
  responses?: Record<string, unknown>;
};

describe('OpenAPI generated spec (contract)', () => {
  it('lists verifyWorkspacePlatformApiKey under platform-api-keys/verify', () => {
    const raw = readFileSync(specPath, 'utf8');
    const doc = parse(raw, openApiYamlOptions) as {
      paths?: Record<string, Record<string, { operationId?: string; parameters?: unknown[] }>>;
    };
    const verify = doc.paths?.['/workspaces/{workspaceId}/platform-api-keys/verify']?.get;
    expect(verify?.operationId).toBe('verifyWorkspacePlatformApiKey');
    const headerNames =
      verify?.parameters?.map((p: { name?: string }) => p.name).filter(Boolean) ?? [];
    expect(headerNames).toContain('x-workspace-platform-key');
  });

  it('is valid YAML 3.x with operationId and standard error responses', () => {
    const raw = readFileSync(specPath, 'utf8');
    expect(raw.trimStart().startsWith('openapi:')).toBe(true);

    const doc = parse(raw, openApiYamlOptions) as {
      openapi?: string;
      paths?: Record<string, PathItem>;
    };

    expect(doc.openapi ?? '').toMatch(/^3\./);
    const paths = doc.paths ?? {};
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete'] as const;

    let operationCount = 0;
    const operationIds = new Set<string>();
    for (const [p, pathItem] of Object.entries(paths)) {
      for (const m of httpMethods) {
        const op = pathItem[m] as Operation | undefined;
        if (op == null) continue;
        operationCount += 1;
        expect(op.operationId, `${p} ${m}`).toBeTruthy();
        operationIds.add(String(op.operationId));

        const responses = op.responses ?? {};
        const keys = Object.keys(responses);
        expect(
          keys.some((k) => k === '200' || k === '201' || k === '202' || k === '204'),
          `${p} ${m} missing success response`,
        ).toBe(true);
        expect(keys, `${p} ${m} missing 500`).toContain('500');

        const isPublic =
          op.security == null || (Array.isArray(op.security) && op.security.length === 0);
        if (!isPublic) {
          expect(
            keys.includes('401') || keys.includes('403'),
            `${p} ${m} missing 401/403 for protected route`,
          ).toBe(true);
        }
      }
    }

    expect(operationCount).toBeGreaterThanOrEqual(97);
    expect(Array.from(operationIds)).toEqual(
      expect.arrayContaining([
        'listWorkspaceEntityAssignments',
        'createWorkspaceEntityAssignment',
        'deleteWorkspaceEntityAssignment',
        'listWorkspaceUserEntityAssignments',
        'listWorkspacePlatformApiKeys',
        'createWorkspacePlatformApiKey',
        'rotateWorkspacePlatformApiKey',
        'revokeWorkspacePlatformApiKey',
        'getWorkspacePlatformApiKeysUsage',
        'verifyWorkspacePlatformApiKey',
        'associateWorkspaceProject',
        'dissociateWorkspaceProject',
      ]),
    );
  });
});
