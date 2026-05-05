import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportErrorReport, supportErrorReportStorageKey } from './SupportErrorReport';
import type { NormalizedApiError } from '../../lib/httpError';

const error: NormalizedApiError = {
  category: 'network',
  reason: 'network_error',
  endpoint: '/workspaces',
  method: 'GET',
  userMessage: 'Non riusciamo a collegarci al servizio. Riprova tra qualche secondo.',
  technicalMessage: 'Failed to fetch',
};

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
        error={error}
        context={{ source: 'ProjectAccessPage', userEmail: 'user@tecma.test' }}
        onRetry={vi.fn()}
        onBackToLogin={vi.fn()}
      />,
    );

    expect(screen.getByText('Qualcosa non ha funzionato')).toBeInTheDocument();
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
        error={error}
        context={{ source: 'ProjectAccessPage', workspaceId: 'ws-1', projectIds: ['p1'] }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Segnala problema' }));

    const stored = JSON.parse(localStorage.getItem(supportErrorReportStorageKey) ?? '[]') as Array<{
      context: { source: string; workspaceId: string; projectIds: string[] };
      error: { reason: string; endpoint: string };
    }>;
    expect(stored[0]).toMatchObject({
      context: { source: 'ProjectAccessPage', workspaceId: 'ws-1', projectIds: ['p1'] },
      error: { reason: 'network_error', endpoint: '/workspaces' },
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
        error={error}
        context={{ source: 'ProjectAccessPage' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copia dettagli' }));

    expect(screen.getByText('Dettagli copiati.')).toBeInTheDocument();
  });
});
