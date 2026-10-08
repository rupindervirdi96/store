import nodemailer, { type Transporter } from 'nodemailer';
import { STORE_BRAND } from '@store/shared';
import { env, isProd } from '../../config/env';
import { AppError } from '../../utils/AppError';

interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const SEND_FAILED = "We couldn't send the verification email. Please try again.";

// Created on first use so a misconfigured server still boots.
let smtp: Transporter | undefined;

/** SMTP (e.g. Gmail). Needs a paid Render instance: the free tier blocks outbound SMTP. */
async function sendViaSmtp(email: Email): Promise<void> {
  smtp ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    await smtp.sendMail({ from: env.EMAIL_FROM, ...email });
  } catch (err) {
    console.error('[email] SMTP send failed', err);
    throw new AppError(502, SEND_FAILED);
  }
}

/**
 * Sends through SMTP when SMTP_USER/SMTP_PASS are set, else Resend's HTTP API.
 * With neither, development prints the email to the console instead.
 */
async function sendEmail(email: Email): Promise<void> {
  if (env.SMTP_USER && env.SMTP_PASS) return sendViaSmtp(email);

  if (!env.RESEND_API_KEY) {
    if (isProd) throw new AppError(503, 'Email is not configured on the server. Please try again later.');
    console.info(`\n[email] (no email provider configured, not sent)\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
    signal: AbortSignal.timeout(10_000),
  }).catch((err: Error) => {
    console.error('[email] request failed', err);
    return null;
  });

  if (!res?.ok) {
    if (res) console.error(`[email] Resend responded ${res.status}: ${await res.text().catch(() => '')}`);
    throw new AppError(502, SEND_FAILED);
  }
}

export function sendVerificationCode(to: string, name: string, code: string, validMinutes: number) {
  const subject = `${code} is your ${STORE_BRAND.name} verification code`;
  const text = [
    `Hi ${name},`,
    '',
    `Your ${STORE_BRAND.name} verification code is: ${code}`,
    '',
    `It expires in ${validMinutes} minutes. If you didn't try to create an account, you can ignore this email.`,
  ].join('\n');
  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1917">
  <p style="font-size:18px;font-weight:800;margin:0 0 16px">🔥 ${escapeHtml(STORE_BRAND.name)}</p>
  <p>Hi ${escapeHtml(name)},</p>
  <p>Use this code to finish creating your account:</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;background:#fff7ed;color:#c2410c;border-radius:12px;padding:16px;text-align:center;margin:16px 0">${code}</p>
  <p style="color:#57534e;font-size:14px">It expires in ${validMinutes} minutes. If you didn't try to create an account, you can ignore this email.</p>
</div>`;
  return sendEmail({ to, subject, text, html });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
