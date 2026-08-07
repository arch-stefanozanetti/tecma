import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMailPort } from './createMailPort.js';

const nodemailerMock = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: nodemailerMock.createTransport,
  },
}));

describe('createMailPort', () => {
  beforeEach(() => {
    nodemailerMock.createTransport.mockReset();
    nodemailerMock.sendMail.mockReset();
    nodemailerMock.sendMail.mockResolvedValue(undefined);
    nodemailerMock.createTransport.mockReturnValue({ sendMail: nodemailerMock.sendMail });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sendTemplate renders flow with variables', async () => {
    vi.stubEnv('SMTP_URL', '');
    vi.stubEnv('SMTP_HOST', '');
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
      text: expect.stringContaining('ws-1'),
      reason: 'smtp_not_configured',
    });
  });

  it('sends real SMTP in development when SMTP is configured', async () => {
    vi.stubEnv('SMTP_URL', '');
    vi.stubEnv('SMTP_HOST', 'email-smtp.eu-west-1.amazonaws.com');
    vi.stubEnv('SMTP_PORT', '587');
    vi.stubEnv('SMTP_SECURE', 'false');
    vi.stubEnv('SMTP_USER', 'smtp-user');
    vi.stubEnv('SMTP_PASS', 'smtp-pass');
    vi.stubEnv('SMTP_FROM', 'Followup Local <noreply@example.com>');
    const log = vi.fn();
    const mail = createMailPort({ nodeEnv: 'development', log });

    await mail.sendMail({ to: 'guest@example.com', subject: 'Invito', text: 'Test locale' });

    expect(nodemailerMock.createTransport).toHaveBeenCalledWith({
      host: 'email-smtp.eu-west-1.amazonaws.com',
      port: 587,
      secure: false,
      auth: { user: 'smtp-user', pass: 'smtp-pass' },
    });
    expect(nodemailerMock.sendMail).toHaveBeenCalledWith({
      from: 'Followup Local <noreply@example.com>',
      to: 'guest@example.com',
      subject: 'Invito',
      text: 'Test locale',
    });
    expect(log).toHaveBeenCalledWith('mail.sent', {
      to: 'guest@example.com',
      subject: 'Invito',
    });
  });

  it('can force mock delivery even when SMTP is configured', async () => {
    vi.stubEnv('SMTP_HOST', 'email-smtp.eu-west-1.amazonaws.com');
    const log = vi.fn();
    const mail = createMailPort({ nodeEnv: 'development', log, deliveryMode: 'mock' });

    await mail.sendMail({ to: 'guest@example.com', subject: 'Invito', text: 'Test locale' });

    expect(nodemailerMock.sendMail).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('mail.mock', {
      to: 'guest@example.com',
      subject: 'Invito',
      text: 'Test locale',
      reason: 'forced_mock',
    });
  });

  it('throws when SMTP delivery is forced without SMTP config', () => {
    vi.stubEnv('SMTP_URL', '');
    vi.stubEnv('SMTP_HOST', '');
    expect(() => createMailPort({ nodeEnv: 'development', deliveryMode: 'smtp' })).toThrow(
      'SMTP_DELIVERY_MODE=smtp requires SMTP_URL or SMTP_HOST',
    );
  });

  it('is no-op in test environment', async () => {
    const log = vi.fn();
    const mail = createMailPort({ nodeEnv: 'test', log });
    await mail.sendMail({ to: 'a@example.com', subject: 'S', text: 'T' });
    expect(log).not.toHaveBeenCalled();
  });

  it('throws in production without SMTP config', () => {
    vi.stubEnv('SMTP_URL', '');
    vi.stubEnv('SMTP_HOST', '');
    expect(() => createMailPort({ nodeEnv: 'production' })).toThrow('[MAIL_CONFIG]');
  });

  it('throws on unknown flow key', async () => {
    const mail = createMailPort({ nodeEnv: 'test' });
    await expect(
      mail.sendTemplate({ to: 'a@example.com', flowKey: 'unknown_flow' as any, vars: {} }),
    ).rejects.toThrow('Unknown flow key');
  });

  describe('DB-driven template lookup', () => {
    it('uses DB override when lookupFlow returns a template', async () => {
      vi.stubEnv('SMTP_URL', '');
      vi.stubEnv('SMTP_HOST', '');
      const log = vi.fn();
      const dbFlow = {
        subject: 'Override soggetto: {{workspaceId}}',
        text: 'Override testo: {{inviteUrl}}',
      };
      const lookupFlow = vi.fn().mockResolvedValue(dbFlow);
      const mail = createMailPort({ nodeEnv: 'development', log, lookupFlow });

      await mail.sendTemplate({
        to: 'user@example.com',
        flowKey: 'workspace_invite',
        vars: { workspaceId: 'ws-custom', inviteUrl: 'https://app.test/invite/abc' },
      });

      expect(lookupFlow).toHaveBeenCalledWith('workspace_invite');
      expect(log).toHaveBeenCalledWith('mail.mock', {
        to: 'user@example.com',
        subject: 'Override soggetto: ws-custom',
        text: 'Override testo: https://app.test/invite/abc',
        reason: 'smtp_not_configured',
      });
    });

    it('falls back to static default when lookupFlow returns null', async () => {
      vi.stubEnv('SMTP_URL', '');
      vi.stubEnv('SMTP_HOST', '');
      const log = vi.fn();
      const lookupFlow = vi.fn().mockResolvedValue(null);
      const mail = createMailPort({ nodeEnv: 'development', log, lookupFlow });

      await mail.sendTemplate({
        to: 'user@example.com',
        flowKey: 'forgot_password',
        vars: { resetUrl: 'https://app.test/reset/token123' },
      });

      expect(lookupFlow).toHaveBeenCalledWith('forgot_password');
      // Falls back to defaultEmailFlows.forgot_password
      expect(log).toHaveBeenCalledWith('mail.mock', {
        to: 'user@example.com',
        subject: 'Reset password Followup',
        text: expect.stringContaining('https://app.test/reset/token123'),
        reason: 'smtp_not_configured',
      });
    });

    it('DB override takes precedence over static flows option', async () => {
      vi.stubEnv('SMTP_URL', '');
      vi.stubEnv('SMTP_HOST', '');
      const log = vi.fn();
      const staticOverride = { subject: 'Static override', text: 'Static text' };
      const dbOverride = { subject: 'DB override', text: 'DB text' };
      const lookupFlow = vi.fn().mockResolvedValue(dbOverride);

      const mail = createMailPort({
        nodeEnv: 'development',
        log,
        flows: { welcome: staticOverride },
        lookupFlow,
      });

      await mail.sendTemplate({ to: 'u@test.com', flowKey: 'welcome', vars: {} });

      expect(log).toHaveBeenCalledWith('mail.mock', {
        to: 'u@test.com',
        subject: 'DB override',
        text: 'DB text',
        reason: 'smtp_not_configured',
      });
    });

    it('static flows option overrides code defaults when no DB override', async () => {
      vi.stubEnv('SMTP_URL', '');
      vi.stubEnv('SMTP_HOST', '');
      const log = vi.fn();
      const staticOverride = { subject: 'Static welcome subject', text: 'Static welcome text' };
      const lookupFlow = vi.fn().mockResolvedValue(null);

      const mail = createMailPort({
        nodeEnv: 'development',
        log,
        flows: { welcome: staticOverride },
        lookupFlow,
      });

      await mail.sendTemplate({ to: 'u@test.com', flowKey: 'welcome', vars: {} });

      expect(log).toHaveBeenCalledWith('mail.mock', {
        to: 'u@test.com',
        subject: 'Static welcome subject',
        text: 'Static welcome text',
        reason: 'smtp_not_configured',
      });
    });
  });
});
