import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/**
 * Send an email. When SMTP is not configured (local development) the message
 * is logged to the console instead so flows remain testable end-to-end.
 */
export async function sendMail(options: MailOptions): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    console.log(
      `[mailer] SMTP not configured — email to ${options.to}\n` +
        `Subject: ${options.subject}\n${options.text}`,
    );
    return;
  }
  await transport.sendMail({ from: env.MAIL_FROM, ...options });
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f4f7f4;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8e2">
    <div style="background:#166534;color:#ffffff;padding:20px 28px">
      <h1 style="margin:0;font-size:20px">GeoAgri AI</h1>
      <p style="margin:4px 0 0;font-size:12px;opacity:.85">Smart Farming from Space</p>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 16px;font-size:17px;color:#14532d">${title}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:16px 28px;background:#f8faf8;font-size:11px;color:#64748b">
      You received this email because you have a GeoAgri AI account.
    </div>
  </div>
</body></html>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${url}" style="background:#166534;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px">${label}</a></p>
  <p style="font-size:12px;color:#64748b">Or copy this link into your browser:<br>${url}</p>`;
}

export async function sendVerificationEmail(to: string, firstName: string, token: string): Promise<void> {
  const url = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: 'Verify your GeoAgri AI email address',
    text: `Hi ${firstName},\n\nWelcome to GeoAgri AI! Verify your email:\n${url}\n\nThe link expires in 24 hours.`,
    html: layout(
      `Welcome, ${firstName}!`,
      `<p style="font-size:14px;color:#334155">Thanks for signing up. Please confirm your email address to activate your 14-day free trial.</p>${button(url, 'Verify Email')}`,
    ),
  });
}

export async function sendPasswordResetEmail(to: string, firstName: string, token: string): Promise<void> {
  const url = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: 'Reset your GeoAgri AI password',
    text: `Hi ${firstName},\n\nReset your password:\n${url}\n\nThe link expires in 1 hour. If you didn't request this, ignore this email.`,
    html: layout(
      'Password reset',
      `<p style="font-size:14px;color:#334155">We received a request to reset your password. This link expires in 1 hour.</p>${button(url, 'Reset Password')}<p style="font-size:12px;color:#64748b">If you didn't request this, you can safely ignore this email.</p>`,
    ),
  });
}

export async function sendPaymentApprovedEmail(
  to: string,
  firstName: string,
  planName: string,
  invoiceNumber: string,
): Promise<void> {
  await sendMail({
    to,
    subject: `Your GeoAgri AI ${planName} subscription is active`,
    text: `Hi ${firstName},\n\nYour payment was approved and your ${planName} subscription is now active. Invoice: ${invoiceNumber}.\n\nOpen your dashboard: ${env.FRONTEND_URL}/dashboard`,
    html: layout(
      'Payment approved 🎉',
      `<p style="font-size:14px;color:#334155">Your payment was approved and your <strong>${planName}</strong> subscription is now active.</p>
       <p style="font-size:14px;color:#334155">Invoice number: <strong>${invoiceNumber}</strong> (available in your billing page).</p>
       ${button(`${env.FRONTEND_URL}/dashboard`, 'Open Dashboard')}`,
    ),
  });
}

export async function sendPaymentRejectedEmail(
  to: string,
  firstName: string,
  planName: string,
  reason: string,
): Promise<void> {
  await sendMail({
    to,
    subject: 'Your GeoAgri AI payment could not be verified',
    text: `Hi ${firstName},\n\nYour payment for the ${planName} plan was rejected.\nReason: ${reason}\n\nYou can submit a new payment: ${env.FRONTEND_URL}/billing`,
    html: layout(
      'Payment rejected',
      `<p style="font-size:14px;color:#334155">Unfortunately we could not verify your payment for the <strong>${planName}</strong> plan.</p>
       <p style="font-size:14px;color:#334155">Reason: <em>${reason}</em></p>
       ${button(`${env.FRONTEND_URL}/billing`, 'Try Again')}`,
    ),
  });
}
