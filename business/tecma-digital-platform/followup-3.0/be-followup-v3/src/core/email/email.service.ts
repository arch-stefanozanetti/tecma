import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { ENV } from "../../config/env.js";

export type SentEmailRecord = {
  to: string;
  subject: string;
  html: string;
  kind: "invite" | "password_reset" | "email_verification";
};

const mockOutbox: SentEmailRecord[] = [];

let transporter: Transporter | null = null;

/** true se l'invito può inviare email reali (SMTP configurato). */
export function isInviteEmailDeliverable(): boolean {
  if (ENV.EMAIL_TRANSPORT !== "smtp") return false;
  return Boolean(ENV.SES_SMTP_USER?.trim() && ENV.SES_SMTP_PASS?.trim());
}

function getTransporter(): Transporter | null {
  if (ENV.EMAIL_TRANSPORT === "mock") return null;
  if (!ENV.SES_SMTP_USER || !ENV.SES_SMTP_PASS) {
    console.warn("[email] EMAIL_TRANSPORT=smtp but SES credentials missing; falling back to mock");
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: ENV.SES_SMTP_HOST,
      port: ENV.SES_SMTP_PORT,
      secure: false,
      auth: {
        user: ENV.SES_SMTP_USER,
        pass: ENV.SES_SMTP_PASS
      }
    });
  }
  return transporter;
}

async function sendHtml(to: string, subject: string, html: string, kind: SentEmailRecord["kind"]): Promise<void> {
  const record: SentEmailRecord = { to, subject, html, kind };
  const tx = getTransporter();
  if (!tx) {
    mockOutbox.push(record);
    if (ENV.APP_ENV !== "test") {
      // eslint-disable-next-line no-console
      console.info(`[email mock] ${kind} -> ${to}: ${subject}`);
    }
    return;
  }
  try {
    await tx.sendMail({
      from: ENV.EMAIL_FROM,
      to,
      subject,
      html
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`SMTP: ${detail}`);
  }
}

/** Solo per test */
export function resetEmailMockOutbox(): void {
  mockOutbox.length = 0;
}

export function getEmailMockOutbox(): readonly SentEmailRecord[] {
  return mockOutbox;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendInviteEmail(params: {
  to: string;
  token: string;
  projectName: string;
  roleLabel: string;
  /** Base del frontend (es. https://followup.onrender.com) per il link set-password */
  appPublicBaseUrl: string;
}): Promise<void> {
  const base = params.appPublicBaseUrl.replace(/\/$/, "");
  const link = `${base}/set-password?token=${encodeURIComponent(params.token)}`;
  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; max-width: 560px;">
  <h1>Invito a Followup</h1>
  <p>Sei stato invitato come <strong>${escapeHtml(params.roleLabel)}</strong> sul progetto <strong>${escapeHtml(params.projectName)}</strong>.</p>
  <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:8px;">Imposta la password</a></p>
  <p style="color:#666;font-size:14px;">Se non ti aspettavi questa email, ignoralo.</p>
</body></html>`;
  await sendHtml(params.to, `Invito Followup — ${params.projectName}`, html, "invite");
}

export async function sendPasswordResetEmail(params: { to: string; token: string }): Promise<void> {
  const link = `${ENV.APP_PUBLIC_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(params.token)}`;
  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; max-width: 560px;">
  <h1>Reimposta password</h1>
  <p>Hai richiesto il reset della password. Clicca il link qui sotto (valido per un tempo limitato).</p>
  <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:8px;">Reimposta password</a></p>
  <p style="color:#666;font-size:14px;">Se non hai richiesto il reset, ignora questa email.</p>
</body></html>`;
  await sendHtml(params.to, "Reimposta password Followup", html, "password_reset");
}

export async function sendEmailVerificationEmail(params: { to: string; token: string; projectName: string }): Promise<void> {
  const link = `${ENV.APP_PUBLIC_URL.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(params.token)}`;
  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; max-width: 560px;">
  <h1>Verifica email</h1>
  <p>Conferma il tuo indirizzo per <strong>${escapeHtml(params.projectName)}</strong>.</p>
  <p><a href="${escapeHtml(link)}">Verifica email</a></p>
</body></html>`;
  await sendHtml(params.to, "Verifica email Followup", html, "email_verification");
}
