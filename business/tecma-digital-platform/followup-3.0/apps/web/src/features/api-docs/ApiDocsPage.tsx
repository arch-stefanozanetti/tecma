import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '../../components/ui/button';
import { apiBaseUrl } from '../../lib/http';

type OpenApiDoc = {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  paths?: Record<string, Record<string, { operationId?: string; summary?: string; description?: string }>>;
};

type OperationRow = {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
};

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

function collectOperations(doc: OpenApiDoc): OperationRow[] {
  const out: OperationRow[] = [];
  const paths = doc.paths ?? {};
  for (const [p, item] of Object.entries(paths)) {
    if (item == null || typeof item !== 'object') continue;
    for (const [method, op] of Object.entries(item)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      const operation = op as { operationId?: string; summary?: string };
      const row: OperationRow = {
        method: method.toUpperCase(),
        path: p,
      };
      if (operation.operationId != null) row.operationId = operation.operationId;
      if (operation.summary != null) row.summary = operation.summary;
      out.push(row);
    }
  }
  out.sort((a, b) => {
    const pc = a.path.localeCompare(b.path);
    if (pc !== 0) return pc;
    return a.method.localeCompare(b.method);
  });
  return out;
}

export const ApiDocsPage = () => {
  const specUrl = `${apiBaseUrl}/openapi.json`;
  const swaggerUrl = `${apiBaseUrl}/docs`;
  const [doc, setDoc] = useState<OpenApiDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(specUrl, { credentials: 'omit' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<OpenApiDoc>;
      })
      .then((j) => {
        if (!cancelled) setDoc(j);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Impossibile caricare la specifica OpenAPI.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [specUrl]);

  const rows = useMemo(() => (doc != null ? collectOperations(doc) : []), [doc]);

  return (
    <div className="min-h-screen bg-app px-4 py-10 font-body text-foreground">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Followup 3.0
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">Documentazione API</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Elenco operazioni dalla specifica OpenAPI generata dal backend (Fastify +
              @fastify/swagger). La UI interattiva è Swagger UI.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="default" asChild>
              <a href={swaggerUrl} target="_blank" rel="noreferrer">
                Apri Swagger UI
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={specUrl} target="_blank" rel="noreferrer">
                Scarica openapi.json
              </a>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/">Torna all&apos;app</Link>
            </Button>
          </div>
        </div>

        {doc?.info?.title != null ? (
          <p className="mb-6 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{doc.info.title}</span>
            {doc.info.version != null ? ` · v${doc.info.version}` : null}
            {doc.openapi != null ? ` · OpenAPI ${doc.openapi}` : null}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Caricamento specifica…</p>
        ) : error != null ? (
          <div
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error} Verifica che l&apos;API sia raggiungibile e che in sviluppo il proxy Vite punti al
            backend (<code className="rounded bg-muted px-1">/v1</code>).
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-panel">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 font-semibold text-foreground">Metodo</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Percorso</th>
                  <th className="px-4 py-3 font-semibold text-foreground">operationId</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Descrizione</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.method}:${row.path}`} className="border-b border-border/80">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs font-medium text-primary">
                      {row.method}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-foreground">{row.path}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {row.operationId ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{row.summary ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              Totale operazioni: {rows.length}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
