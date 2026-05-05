import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SupportErrorReport,
  sanitizeSupportPayload,
  supportErrorReportStorageKey,
} from './SupportErrorReport';

let writeTextMock: ReturnType<typeof vi.fn>;

describe('SupportErrorReport', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });
  });

  it('mostra messaggio semplice e azioni principali', () => {
    render(
      <SupportErrorReport
        userMessage="Riprova tra qualche secondo."
        severity="medium"
        source="ProjectAccessPage"
        userEmail="user@tecma.test"
        technicalContext={{ endpoint: '/workspaces', method: 'GET' }}
        onRetry={vi.fn()}
        onBackToLogin={vi.fn()}
      />,
    );

    expect(screen.getByText('Qualcosa non ha funzionato.')).toBeInTheDocument();
    expect(screen.getByText('Riprova tra qualche secondo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Torna al login' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Segnala problema' })).toBeInTheDocument();
  });

  it('salva una bozza strutturata per futura integrazione ticket', async () => {
    const user = userEvent.setup();
    render(
      <SupportErrorReport
        userMessage="Riprova tra qualche secondo."
        severity="high"
        source="ProjectAccessPage"
        workspaceId="ws-1"
        projectIds={['p1']}
        endpoint="/workspaces"
        method="GET"
        responseStatus={503}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Segnala problema' }));

    const stored = JSON.parse(localStorage.getItem(supportErrorReportStorageKey) ?? '[]') as Array<{
      source: string;
      session: { workspaceId: string; projectIds: string[] };
      request: { endpoint: string; method: string; responseStatus: number };
    }>;
    expect(stored[0]).toMatchObject({
      source: 'ProjectAccessPage',
      session: { workspaceId: 'ws-1', projectIds: ['p1'] },
      request: { endpoint: '/workspaces', method: 'GET', responseStatus: 503 },
    });
    expect(
      screen.getByText(
        'Segnalazione preparata. Il collegamento automatico al ticket sarà attivato a breve.',
      ),
    ).toBeInTheDocument();
  });

  it('copia i dettagli tecnici su richiesta', async () => {
    const user = userEvent.setup();
    render(
      <SupportErrorReport
        userMessage="Riprova tra qualche secondo."
        severity="low"
        source="ProjectAccessPage"
        technicalContext={{ endpoint: '/workspaces' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copia dettagli' }));

    expect(screen.getByText('Dettagli copiati.')).toBeInTheDocument();
  });

  it('sanitizeSupportPayload rimuove campi sensibili in modo ricorsivo', () => {
    const input = {
      token: 'abc',
      nested: {
        authorization: 'Bearer x',
        keep: 'ok',
        deep: [{ apiKey: '123' }, { data: 1 }],
      },
    };
    expect(sanitizeSupportPayload(input)).toEqual({
      nested: { keep: 'ok', deep: [{}, { data: 1 }] },
    });
  });
});
