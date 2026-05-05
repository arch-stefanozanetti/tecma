import { useMemo, useState } from 'react';

import { Button } from '../ui/button';
import type { NormalizedApiError } from '../../lib/httpError';

export type SupportErrorContext = {
  source: string;
  userEmail?: string | null;
  workspaceId?: string | null;
  projectIds?: string[];
};

export type SupportErrorReportProps = {
  title?: string;
  userMessage: string;
  error: NormalizedApiError;
  context: SupportErrorContext;
  onRetry?: () => void;
  onBackToLogin?: () => void;
};

type StoredSupportReport = {
  id: string;
  createdAt: string;
  title: string;
  userMessage: string;
  context: SupportErrorContext;
  error: Omit<NormalizedApiError, 'originalError'>;
};

const STORAGE_KEY = 'followup.supportReports';

const createReportId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `support-${Date.now()}`;
};

const readReports = (): StoredSupportReport[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredSupportReport[]) : [];
  } catch {
    return [];
  }
};

const writeReport = (report: StoredSupportReport): void => {
  if (typeof window === 'undefined') return;
  try {
    const next = [report, ...readReports()].slice(0, 20);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore private mode / quota */
  }
};

const buildReport = (
  title: string,
  userMessage: string,
  error: NormalizedApiError,
  context: SupportErrorContext,
): StoredSupportReport => {
  const { originalError: _originalError, ...safeError } = error;
  return {
    id: createReportId(),
    createdAt: new Date().toISOString(),
    title,
    userMessage,
    context,
    error: safeError,
  };
};

export const SupportErrorReport = ({
  title = 'Qualcosa non ha funzionato',
  userMessage,
  error,
  context,
  onRetry,
  onBackToLogin,
}: SupportErrorReportProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const report = useMemo(
    () => buildReport(title, userMessage, error, context),
    [context, error, title, userMessage],
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
      console.info('[SupportErrorReport] Segnalazione preparata', report);
    }
    setFeedback(
      'Segnalazione preparata. Il collegamento automatico al ticket sarà attivato a breve.',
    );
  };

  return (
    <div className="space-y-3 rounded-ui border border-border bg-background px-4 py-4 text-sm">
      <div>
        <p className="font-medium text-foreground">{title}</p>
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
