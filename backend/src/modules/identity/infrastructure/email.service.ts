import nodemailer, { type Transporter } from 'nodemailer';
import { getEnv } from '../../../config/env';
import { AppError } from '../../../shared/errors/app-error';

export interface VerificationEmailInput {
  to: string;
  displayName: string;
  token: string;
}

export interface EmailService {
  sendVerificationEmail(input: VerificationEmailInput): Promise<void>;
}

export class GmailEmailService implements EmailService {
  private readonly transporter: Transporter;

  public constructor() {
    const env = getEnv();
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      ...(env.SMTP_PORT === 587 ? { requireTLS: true } : {}),
      auth: {
        user: env.SMTP_USER ?? '',
        pass: env.SMTP_PASSWORD ?? '',
      },
    });
  }

  public async sendVerificationEmail(input: VerificationEmailInput): Promise<void> {
    const env = getEnv();
    if (!env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM)
      throw new AppError(
        'SMTP_NOT_CONFIGURED',
        'Email delivery is not configured for this environment.',
        503,
      );
    const verificationUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(input.token)}`;
    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: 'Verify your CampusConnection email',
      text: [
        `Welcome to CampusConnection, ${input.displayName}.`,
        '',
        'Verify your email to activate your CampusConnection account:',
        verificationUrl,
        '',
        'This verification link expires in 30 minutes.',
        'If you did not create this account, you can safely ignore this email.',
      ].join('\n'),
      html: verificationEmailHtml(input.displayName, verificationUrl),
    });
  }
}

function verificationEmailHtml(displayName: string, verificationUrl: string): string {
  const safeName = escapeHtml(displayName);
  const safeUrl = escapeHtml(verificationUrl);
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f9fc;font-family:Arial,Helvetica,sans-serif;color:#172033">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px">
      <div style="background:#082445;border-radius:18px 18px 0 0;padding:28px 32px;color:#fff">
        <div style="font-size:18px;font-weight:700;letter-spacing:-.02em">CampusConnection</div>
        <div style="margin-top:8px;color:#feb21a;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase">Your campus, connected</div>
      </div>
      <div style="background:#fff;border:1px solid #e5e9ef;border-top:0;border-radius:0 0 18px 18px;padding:32px">
        <p style="margin:0;color:#526071">Welcome, ${safeName}.</p>
        <h1 style="margin:12px 0 16px;font-size:28px;line-height:1.15">Verify your email</h1>
        <p style="margin:0;color:#526071;line-height:1.7">Confirm your email to activate your CampusConnection account and join your campus community.</p>
        <p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#134686;color:#fff;text-decoration:none;border-radius:10px;padding:14px 20px;font-weight:700">VERIFY EMAIL</a></p>
        <p style="margin:0;color:#7a8492;font-size:13px;line-height:1.6">This verification link expires in 30 minutes.</p>
        <p style="margin:16px 0 0;color:#7a8492;font-size:13px;line-height:1.6">If you did not create this account, you can safely ignore this email.</p>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });
}
