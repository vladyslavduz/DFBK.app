import { useState, type FormEvent } from 'react';
import { authService } from '../services/auth';

export function authMailError(error: unknown) {
  if (error instanceof Error && error.message === 'RATE_LIMITED') {
    return 'Zu viele Anfragen. Bitte warte eine Minute und versuche es erneut.';
  }
  if (error instanceof Error && error.message === 'INVALID_EMAIL') {
    return 'Bitte gib eine gültige E-Mail-Adresse ein.';
  }
  return 'Die Anfrage konnte nicht verarbeitet werden. Bitte versuche es später erneut.';
}

export const verificationRequestAccepted =
  'Falls für diese Adresse eine Bestätigung aussteht, erhältst du einen neuen Link. Warte bei einer erneuten Anfrage mindestens eine Minute.';

export default function AuthEmailForm({ verification = false }: { verification?: boolean }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') || '');
    setPending(true);
    setSent(false);
    setError('');
    try {
      const request = verification ? authService.resendVerification : authService.forgotPassword;
      await request(email);
      setSent(true);
    } catch (requestError) {
      setError(authMailError(requestError));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <label>E-Mail-Adresse<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
      <button className="button" type="submit" disabled={pending}>
        {pending ? 'Einen Moment…' : verification ? 'Bestätigungslink anfordern' : 'Link anfordern'}
      </button>
      {error && <p role="alert">{error}</p>}
      {sent && <p role="status">{verification
        ? verificationRequestAccepted
        : 'Falls für diese Adresse ein Konto mit Passwort besteht, erhältst du einen Link zum Zurücksetzen. Prüfe auch den Spam-Ordner.'}</p>}
    </form>
  );
}
