export const EMAIL_FLOW_KEYS = ["user_invite", "password_reset", "email_verification"] as const;
export type EmailFlowKey = (typeof EMAIL_FLOW_KEYS)[number];

export type EmailFlowMeta = {
  flowKey: EmailFlowKey;
  label: string;
  description: string;
  placeholders: string[];
};

export const EMAIL_FLOW_METADATA: Record<EmailFlowKey, Omit<EmailFlowMeta, "flowKey">> = {
  user_invite: {
    label: "Invito utente",
    description: "Invito a impostare la password su un progetto.",
    placeholders: ["inviteLink", "roleLabel", "projectName"]
  },
  password_reset: {
    label: "Reset password",
    description: "Link per reimpostare la password.",
    placeholders: ["resetLink"]
  },
  email_verification: {
    label: "Verifica email",
    description: "Conferma indirizzo email.",
    placeholders: ["verifyLink", "projectName"]
  }
};
