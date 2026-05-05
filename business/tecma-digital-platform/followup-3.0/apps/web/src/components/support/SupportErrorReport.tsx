import { useMemo, useState } from 'react';

import { Button } from '../ui/button';
import { readAuthSession } from '../../lib/authSession';

export type SupportErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

type ReportPayload = {
  id: string;
  createdAt: string;
  severity: SupportErrorSeverity;
  source: string;
  userMessage: string;
  technicalContext?: unknown;
  session: {
    isAuthenticated: boolean;
    userId?: string;
    userEmail?: string;
    workspaceId?: string;
    projectIds?: string[];
  };
  request: {
    endpoint?: string;
    method?: string;
    requestId?: string;
    traceId?: string;
    lastApiCall?: string;
    responseStatus?: number;
  };
  client: {
    url: string;
    route: string;
    userAgent: string;
    appVersion?: string;
    environment?: string;
  };
};

export type SupportErrorReportProps = {
  userMessage: string;
  technicalContext?: unknown;
  severity: SupportErrorSeverity;
  source: string;
  userEmail?: string | undefined;
  userId?: string | undefined;
  workspaceId?: string | undefined;
  projectIds?: string[] | undefined;
  endpoint?: string | undefined;
  method?: string | undefined;
  requestId?: string | undefined;
  traceId?: string | undefined;
  responseStatus?: number | undefined;
  onRetry?: () => void;
  onBackToLogin?: () => void;
};

const STORAGE_KEY = 'support_error_reports';
const SENSITIVE_FIELD_MATCH = /(token|accessToken|refreshToken|authorization|cookie|password|secret|apiKey|jwt)/i;

const createReportId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `support-${Date.now()}`;
};

const readReports = (): ReportPayload[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReportPayload[]) : [];
  } catch {
    return [];
  }
};

const writeReport = (report: ReportPayload): void => {
  if (typeof window === 'undefined') return;
  try {
    const next = [report, ...readReports()].slice(0, 20);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore private mode / quota */
  }
};

export const sanitizeSupportPayload = (payload: unknown): unknown => {
  if (Array.isArray(payload)) return payload.map((entry) => sanitizeSupportPayload(entry));
  if (payload == null || typeof payload !== 'object') return payload;
  const source = payload as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (SENSITIVE_FIELD_MATCH.test(key)) continue;
    out[key] = sanitizeSupportPayload(value);
  }
  return out;
};

const downloadJson = (filename: string, jsonText: string): void => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([jsonText], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const buildReport = (props: SupportErrorReportProps): ReportPayload => {
  const authSession = readAuthSession();
  const isAuthenticated = authSession != null;
  const now = new Date().toISOString();
  return {
    id: createReportId(),
    createdAt: now,
    severity: props.severity,
    source: props.source,
    userMessage: props.userMessage,
    technicalContext: sanitizeSupportPayload(props.technicalContext),
    session: {
      isAuthenticated,
      ...(props.userId != null ? { userId: props.userId } : {}),
      ...(props.userEmail != null ? { userEmail: props.userEmail } : {}),
      ...(props.workspaceId != null ? { workspaceId: props.workspaceId } : {}),
      ...(props.projectIds != null ? { projectIds: props.projectIds } : {}),
    },
    request: {
      ...(props.endpoint != null ? { endpoint: props.endpoint } : {}),
      ...(props.method != null ? { method: props.method } : {}),
      ...(props.requestId != null ? { requestId: props.requestId } : {}),
      ...(props.traceId != null ? { traceId: props.traceId } : {}),
      ...(props.endpoint != null && props.method != null
        ? { lastApiCall: `${props.method} ${props.endpoint}` }
        : {}),
      ...(props.responseStatus != null ? { responseStatus: props.responseStatus } : {}),
    },
    client: {
      url: typeof window !== 'undefined' ? window.location.href : '',
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      ...(typeof import.meta.env.VITE_APP_VERSION === 'string'
        ? { appVersion: import.meta.env.VITE_APP_VERSION }
        : {}),
      ...(typeof import.meta.env.VITE_APP_ENV === 'string'
        ? { environment: import.meta.env.VITE_APP_ENV }
        : {}),
    },
  };
};

export const prepareJiraIssuePayload = (report: ReportPayload): Record<string, unknown> => ({
  summary: `[Support] ${report.source} - ${report.userMessage}`,
  description: JSON.stringify(report, null, 2),
  priority: report.severity,
});

export const SupportErrorReport = ({
  userMessage,
  technicalContext,
  severity,
  source,
  userEmail,
  userId,
  workspaceId,
  projectIds,
  endpoint,
  method,
  requestId,
  traceId,
  responseStatus,
  onRetry,
  onBackToLogin,
}: SupportErrorReportProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const report = useMemo(
    () => {
      const props: SupportErrorReportProps = {
        userMessage,
        technicalContext,
        severity,
        source,
        ...(userEmail != null ? { userEmail } : {}),
        ...(userId != null ? { userId } : {}),
        ...(workspaceId != null ? { workspaceId } : {}),
        ...(projectIds != null ? { projectIds } : {}),
        ...(endpoint != null ? { endpoint } : {}),
        ...(method != null ? { method } : {}),
        ...(requestId != null ? { requestId } : {}),
        ...(traceId != null ? { traceId } : {}),
        ...(responseStatus != null ? { responseStatus } : {}),
      };
      return buildReport(props);
    },
    [
      userMessage,
      technicalContext,
      severity,
      source,
      userEmail,
      userId,
      workspaceId,
      projectIds,
      endpoint,
      method,
      requestId,
      traceId,
      responseStatus,
    ],
  );
  const reportText = useMemo(() => JSON.stringify(report, null, 2), [report]);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setFeedback('Dettagli copiati.');
    } catch {
      setFeedback('Copia non riuscita. Puoi selezionare i dettagli manualmente.');
      setDetailsOpen(true);
    }
  };

  const submitReport = () => {
    writeReport(report);
    if (import.meta.env.DEV) {
      console.info('[SupportErrorReport]', report);
    }
    setFeedback(
      'Segnalazione preparata. Il collegamento automatico al ticket sarà attivato a breve.',
    );
  };

  return (
    <div className="space-y-3 rounded-ui border border-border bg-background px-4 py-4 text-sm">
      <div>
        <p className="font-medium text-foreground">Qualcosa non ha funzionato.</p>
        <p className="mt-1 text-muted-foreground">{userMessage}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {onRetry != null ? (
          <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
            Riprova
          </Button>
        ) : null}
        {onBackToLogin != null ? (
          <Button type="button" size="sm" variant="outline" onClick={onBackToLogin}>
            Torna al login
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={submitReport}>
          Segnala problema
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => void copyReport()}>
          Copia dettagli
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => downloadJson(`support-error-${report.id}.json`, reportText)}
        >
          Scarica JSON
        </Button>
      </div>

      {feedback != null ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" role="status">
          {feedback}
        </p>
      ) : null}

      <div>
        <button
          type="button"
          className="text-xs font-medium text-primary underline underline-offset-2"
          onClick={() => setDetailsOpen((v) => !v)}
        >
          {detailsOpen ? 'Nascondi dettagli tecnici' : 'Mostra dettagli tecnici'}
        </button>
        {detailsOpen ? (
          <pre className="mt-2 max-h-52 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
            {reportText}
          </pre>
        ) : null}
      </div>
    </div>
  );
};

export const supportErrorReportStorageKey = STORAGE_KEY;
