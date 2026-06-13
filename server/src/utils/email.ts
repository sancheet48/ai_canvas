import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

export async function sendEmail({
  to,
  subject,
  text,
  html
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  console.log('-----------------------------------------');
  console.log(`[EMAIL OUTBOX] Sending email to: ${to}`);
  console.log(`[EMAIL OUTBOX] Subject: ${subject}`);
  console.log(`[EMAIL OUTBOX] Text Content:\n${text}`);
  console.log('-----------------------------------------');

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  if (apiKey) {
    try {
      // Lazy import resend if we actually have the API key
      const { Resend } = require('resend');
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: fromEmail,
        to,
        subject,
        html
      });
      console.log(`[EMAIL] Successfully sent email to ${to} via Resend API.`);
      return;
    } catch (err) {
      console.error('[EMAIL] Failed to send via Resend, attempting Nodemailer...', err);
    }
  }

  // Nodemailer fallback if SMTP config exists in environment
  if (process.env.SMTP_HOST) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        text,
        html
      });
      console.log(`[EMAIL] Successfully sent email to ${to} via Nodemailer.`);
      return;
    } catch (err) {
      console.error('[EMAIL] Nodemailer fallback failed:', err);
    }
  }

  console.log('[EMAIL] No external email provider is fully configured. Defaulting to Console Logging.');
}
