import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMailPort } from './createMailPort.js';

describe('createMailPort', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sendTemplate renderizza flow DB-driven-ready con variabili', async () => {
    const log = vi.fn();
    const mail = createMailPort({ nodeEnv: 'development', log });

    await mail.sendTemplate({
      to: 'guest@example.com',
      flowKey: 'workspace_invite',
      vars: { workspaceId: 'ws-1' },
    });

    expect(log).toHaveBeenCalledWith('mail.mock', {
      to: 'guest@example.com',
      subject: 'Invito workspace Followup',
      text: 'Sei stato invitato nel workspace ws-1. Accedi all’app per completare l’accesso.',
    });
  });

  it('in test è no-op', async () => {
    const log = vi.fn();
    const mail = createMailPort({ nodeEnv: 'test', log });
    await mail.sendMail({ to: 'a@example.com', subject: 'S', text: 'T' });
    expect(log).not.toHaveBeenCalled();
  });

  it('in production richiede SMTP_URL o SMTP_HOST', () => {
    vi.stubEnv('SMTP_URL', '');
    vi.stubEnv('SMTP_HOST', '');
    expect(() => createMailPort({ nodeEnv: 'production' })).toThrow('[MAIL_CONFIG]');
  });
});
