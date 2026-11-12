import type { Env } from './env';

type EmailContent = { subject: string; text: string; html?: string };

async function sendEmail(env: Env, to: string, content: EmailContent): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error('Email delivery is not configured');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], ...content }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Email delivery failed: ' + response.status);
}

export function sendVerificationEmail(
  env: Env,
  { to, verificationUrl }: { to: string; verificationUrl: string }
): Promise<void> {
  return sendEmail(env, to, {
    subject: 'E-Mail-Adresse bestätigen – DFBK.app',
    text: 'Bestätige deine E-Mail-Adresse bei DFBK.app:\n' + verificationUrl +
      '\n\nDer Link ist 24 Stunden gültig. Falls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.',
    html: '<div style="font-family:Arial,Helvetica,sans-serif;color:#17212B;line-height:1.6">' +
      '<h2>E-Mail-Adresse bestätigen</h2><p>Vielen Dank für deine Registrierung bei <strong>DFBK.app</strong>.</p>' +
      '<p><a href="' + verificationUrl + '" style="display:inline-block;background:#2563EB;color:#fff;' +
      'text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">E-Mail bestätigen</a></p>' +
      '<p>Der Link ist 24 Stunden gültig.</p>' +
      '<p>Falls du dich nicht bei DFBK.app registriert hast, kannst du diese E-Mail ignorieren.</p></div>',
  });
}

export function sendPasswordResetEmail(env: Env, to: string, resetUrl: string): Promise<void> {
  return sendEmail(env, to, {
    subject: 'Passwort zurücksetzen – DFBK.app',
    text: 'Über diesen Link kannst du ein neues Passwort für dein DFBK.app-Konto setzen:\n' + resetUrl +
      '\n\nDer Link ist 30 Minuten gültig und kann einmal verwendet werden. ' +
      'Falls du kein neues Passwort angefordert hast, kannst du diese E-Mail ignorieren.',
  });
}
