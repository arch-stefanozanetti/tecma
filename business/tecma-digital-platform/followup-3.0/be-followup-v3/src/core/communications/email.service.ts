/**
 * Email per il motore **comunicazioni CRM** (template, regole comunicazione, channel-dispatcher).
 * Variabili: `SMTP_HOST`, `SMTP_FROM` (obbligatori), opzionali `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`.
 *
 * Nota: inviti utenti / verifica email usano un altro stack in `core/email/email.service.ts` (`EMAIL_TRANSPORT`, `SES_SMTP_*`, `EMAIL_FROM`).
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { HttpError } from "../../types/http.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  if (!host || !from) {
    throw new HttpError("SMTP not configured (SMTP_HOST, SMTP_FROM required)", 503);
  }
  transporter = nodemailer.createTransport({
    host,
    port: port ? parseInt(port, 10) : 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: user && pass ? { user, pass } : undefined,
  });
  return transporter;
}

export interface EmailBranding {
  logoUrl?: string;
  primaryColor?: string;
  footerText?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  branding?: EmailBranding;
}

function wrapWithBranding(innerHtml: string, branding?: EmailBranding): string {
  const color = branding?.primaryColor && /^#?[0-9A-Fa-f]{3,8}$/.test(branding.primaryColor)
    ? branding.primaryColor.startsWith("#") ? branding.primaryColor : `#${branding.primaryColor}`
    : "#2563eb";
  const logo = branding?.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="Logo" style="max-height: 48px; margin-bottom: 16px;" />`
    : "";
  const footer = branding?.footerText
    ? `<p style="color: #6b7280; font-size: 12px; margin-top: 24px;">${escapeHtml(branding.footerText)}</p>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111; max-width: 600px; margin: 0 auto; padding: 24px;">
<div style="border-bottom: 3px solid ${escapeHtml(color)}; padding-bottom: 16px;">${logo}</div>
<div style="margin: 20px 0;">${innerHtml}</div>
${footer}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const transport = getTransporter();
  const from = options.from ?? process.env.SMTP_FROM ?? "noreply@followup.local";
  const html = options.html
    ? wrapWithBranding(options.html, options.branding)
    : undefined;
  await transport.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: html ?? undefined,
  });
}
