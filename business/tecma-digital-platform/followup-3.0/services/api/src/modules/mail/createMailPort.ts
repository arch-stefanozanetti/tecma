export type MailPayload = {
  to: string;
  subject: string;
  text: string;
};

export type MailPort = {
  sendMail: (input: MailPayload) => Promise<void>;
};

/** Implementazione di default: nessun SMTP; in test no-op, altrimenti log strutturato. */
export function createMailPort(opts?: { nodeEnv?: string; log?: (msg: string, meta: unknown) => void }): MailPort {
  const nodeEnv = opts?.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  return {
    async sendMail(input: MailPayload): Promise<void> {
      if (nodeEnv === 'test') return;
      opts?.log?.('mail.stub', input);
    },
  };
}
