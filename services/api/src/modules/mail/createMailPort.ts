import nodemailer from 'nodemailer';

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
};

export type MailFlowKey =
  | 'workspace_invite'
  | 'forgot_password'
  | 'password_changed'
  | 'user_invite'
  | 'welcome'
  | 'deactivation';

export type MailTemplatePayload = {
  to: string;
  flowKey: MailFlowKey;
  vars: Record<string, string | number | boolean | null | undefined>;
};

export type EmailFlow = {
  subject: string;
  text: string;
  /** Optional HTML body. If absent, `text` is used as the plain text fallback. */
  html?: string;
};

/**
 * Async function that looks up a flow override from the DB.
 * Returns `null` if no override exists (caller falls back to code defaults).
 */
export type FlowLookupFn = (flowKey: MailFlowKey) => Promise<EmailFlow | null>;

export type MailPort = {
  sendMail: (input: MailPayload) => Promise<void>;
  sendTemplate: (input: MailTemplatePayload) => Promise<void>;
};

export type MailDeliveryMode = 'auto' | 'mock' | 'smtp';

export const defaultEmailFlows: Record<MailFlowKey, EmailFlow> = {
  workspace_invite: {
    subject: 'Invito workspace Followup',
    text: "Sei stato invitato nel workspace {{workspaceId}}.\n\nCompleta l'accesso da qui: {{inviteUrl}}\n\nIl link scade tra 7 giorni.",
  },
  forgot_password: {
    subject: 'Reset password Followup',
    text: 'Usa questo link per reimpostare la password: {{resetUrl}}\n\nIl link scade tra 30 minuti.',
  },
  password_changed: {
    subject: 'Password Followup aggiornata',
    text: 'La password del tuo account Followup è stata aggiornata. Se non sei stato tu, contatta il supporto immediatamente.',
  },
  user_invite: {
    subject: 'Invito a Followup',
    text: 'Sei stato invitato a Followup.\n\nCompleta la registrazione da qui: {{inviteUrl}}\n\nIl link scade tra 7 giorni.',
  },
  welcome: {
    subject: 'Benvenuto su Followup',
    text: 'Benvenuto su Followup, {{email}}!\n\nIl tuo account è attivo. Accedi da qui: {{loginUrl}}',
  },
  deactivation: {
    subject: 'Account Followup disattivato',
    text: 'Il tuo account Followup è stato disattivato. Contatta il supporto per ulteriori informazioni.',
  },
};

export const renderTemplate = (template: string, vars: MailTemplatePayload['vars']): string =>
  template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value == null ? '' : String(value);
  });

const hasSmtpConfig = (): boolean =>
  Boolean(process.env.SMTP_URL?.trim() || process.env.SMTP_HOST?.trim());

const resolveDeliveryMode = (value: string | undefined): MailDeliveryMode => {
  if (value === 'mock' || value === 'smtp' || value === 'auto') return value;
  return 'auto';
};

const buildTransporter = (): nodemailer.Transporter => {
  if (process.env.SMTP_URL?.trim()) {
    return nodemailer.createTransport(process.env.SMTP_URL.trim());
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
      : undefined,
  });
};

/**
 * Implementazione di default: no-op in test, mock se manca SMTP, SMTP reale quando configurato.
 * In locale questo permette di provare gli inviti con AWS SES/SMTP senza cambiare NODE_ENV.
 */
export function createMailPort(opts?: {
  nodeEnv?: string;
  log?: (msg: string, meta: unknown) => void;
  /** Static in-memory flow overrides (for testing or legacy wiring). DB lookup takes precedence. */
  flows?: Partial<Record<MailFlowKey, EmailFlow>>;
  fromAddress?: string;
  deliveryMode?: MailDeliveryMode;
  /**
   * Async function that queries `tz_email_flows` for a DB-persisted override.
   * When provided, DB overrides take precedence over `flows` and code defaults.
   * Falls back to `flows` → `defaultEmailFlows` when the DB lookup returns `null`.
   */
  lookupFlow?: FlowLookupFn;
}): MailPort {
  const nodeEnv = opts?.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const deliveryMode = opts?.deliveryMode ?? resolveDeliveryMode(process.env.SMTP_DELIVERY_MODE);
  const staticFlows = { ...defaultEmailFlows, ...(opts?.flows ?? {}) };
  const fromAddress =
    opts?.fromAddress ?? process.env.SMTP_FROM ?? 'Followup <noreply@followup.tecma.com>';

  if (nodeEnv === 'production' && !hasSmtpConfig()) {
    throw new Error('[MAIL_CONFIG] SMTP_URL or SMTP_HOST is required in production');
  }
  if (nodeEnv !== 'test' && deliveryMode === 'smtp' && !hasSmtpConfig()) {
    throw new Error('[MAIL_CONFIG] SMTP_DELIVERY_MODE=smtp requires SMTP_URL or SMTP_HOST');
  }

  const shouldUseSmtp = (): boolean =>
    nodeEnv !== 'test' && deliveryMode !== 'mock' && hasSmtpConfig();

  let transporter: nodemailer.Transporter | null = null;
  if (shouldUseSmtp()) {
    transporter = buildTransporter();
  }

  const sendMail = async (input: MailPayload): Promise<void> => {
    if (nodeEnv === 'test') return;

    if (!shouldUseSmtp()) {
      opts?.log?.('mail.mock', {
        to: input.to,
        subject: input.subject,
        text: input.text,
        reason: deliveryMode === 'mock' ? 'forced_mock' : 'smtp_not_configured',
      });
      return;
    }

    const t = transporter ?? buildTransporter();
    await t.sendMail({
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    opts?.log?.('mail.sent', { to: input.to, subject: input.subject });
  };

  /**
   * Resolve flow template: DB override → static override → code default.
   * Never throws for an unknown flow key; returns null instead (caller decides).
   */
  const resolveFlow = async (flowKey: MailFlowKey): Promise<EmailFlow | null> => {
    if (opts?.lookupFlow) {
      const dbFlow = await opts.lookupFlow(flowKey);
      if (dbFlow != null) return dbFlow;
    }
    return staticFlows[flowKey] ?? null;
  };

  return {
    sendMail,
    async sendTemplate(input: MailTemplatePayload): Promise<void> {
      const flow = await resolveFlow(input.flowKey);
      if (flow == null) {
        throw new Error(`[MAIL] Unknown flow key: ${input.flowKey}`);
      }
      await sendMail({
        to: input.to,
        subject: renderTemplate(flow.subject, input.vars),
        text: renderTemplate(flow.text, input.vars),
      });
    },
  };
}
