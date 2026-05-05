export type MailPayload = {
  to: string;
  subject: string;
  text: string;
};

export type MailFlowKey = 'workspace_invite' | 'forgot_password' | 'password_changed';

export type MailTemplatePayload = {
  to: string;
  flowKey: MailFlowKey;
  vars: Record<string, string | number | boolean | null | undefined>;
};

export type MailPort = {
  sendMail: (input: MailPayload) => Promise<void>;
  sendTemplate: (input: MailTemplatePayload) => Promise<void>;
};

type EmailFlow = {
  subject: string;
  text: string;
};

export const defaultEmailFlows: Record<MailFlowKey, EmailFlow> = {
  workspace_invite: {
    subject: 'Invito workspace Followup',
    text: 'Sei stato invitato nel workspace {{workspaceId}}. Accedi all’app per completare l’accesso.',
  },
  forgot_password: {
    subject: 'Reset password Followup',
    text: 'Usa questo link per reimpostare la password: {{resetUrl}}',
  },
  password_changed: {
    subject: 'Password Followup aggiornata',
    text: 'La password del tuo account Followup è stata aggiornata.',
  },
};

const renderTemplate = (template: string, vars: MailTemplatePayload['vars']): string =>
  template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value == null ? '' : String(value);
  });

const hasSmtpConfig = (): boolean =>
  Boolean(process.env.SMTP_URL?.trim() || process.env.SMTP_HOST?.trim());

/** Implementazione di default: test no-op, dev log strutturato, production richiede SMTP configurato. */
export function createMailPort(opts?: {
  nodeEnv?: string;
  log?: (msg: string, meta: unknown) => void;
  flows?: Partial<Record<MailFlowKey, EmailFlow>>;
}): MailPort {
  const nodeEnv = opts?.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const flows = { ...defaultEmailFlows, ...(opts?.flows ?? {}) };
  if (nodeEnv === 'production' && !hasSmtpConfig()) {
    throw new Error('[MAIL_CONFIG] SMTP_URL or SMTP_HOST is required in production');
  }

  const sendMail = async (input: MailPayload): Promise<void> => {
    if (nodeEnv === 'test') return;
    opts?.log?.(nodeEnv === 'production' ? 'mail.smtp.required' : 'mail.mock', input);
  };

  return {
    sendMail,
    async sendTemplate(input: MailTemplatePayload): Promise<void> {
      const flow = flows[input.flowKey];
      await sendMail({
        to: input.to,
        subject: renderTemplate(flow.subject, input.vars),
        text: renderTemplate(flow.text, input.vars),
      });
    },
  };
}
