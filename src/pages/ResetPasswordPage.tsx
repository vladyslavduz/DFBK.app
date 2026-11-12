import { useState, type FormEvent } from 'react';
import AppLink from '../components/AppLink';
import PageShell from '../components/PageShell';
import { authMailError } from '../components/AuthEmailForm';
import { authService } from '../services/auth';

export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get('password') || '');
    if (password !== fields.get('passwordConfirmation')) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setPending(true);
    setError('');
    try {
      await authService.resetPassword(token, password);
      window.history.replaceState(window.history.state, '', window.location.pathname);
      setSaved(true);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.message === 'INVALID_RESET_LINK') {
        setInvalid(true);
      } else {
        setError(authMailError(requestError));
      }
    } finally {
      setPending(false);
    }
  }

  if (saved) {
    return (
      <PageShell eyebrow="Konto" title="Passwort geändert" intro="Du kannst dich jetzt mit deinem neuen Passwort anmelden.">
        <AppLink className="button" to="/login">Zur Anmeldung</AppLink>
      </PageShell>
    );
  }

  if (invalid || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return (
      <PageShell eyebrow="Konto" title="Link nicht mehr gültig" intro="Der Link ist ungültig, abgelaufen oder wurde bereits verwendet.">
        <AppLink className="button" to="/forgot-password">Neuen Link anfordern</AppLink>
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow="Konto" title="Neues Passwort" intro="Wähle ein neues Passwort mit mindestens 8 Zeichen.">
      <form className="form-card" onSubmit={submit}>
        <label>Neues Passwort<input type="password" name="password" autoComplete="new-password" minLength={8} maxLength={256} required /></label>
        <label>Passwort wiederholen<input type="password" name="passwordConfirmation" autoComplete="new-password" minLength={8} maxLength={256} required /></label>
        {error && <p role="alert">{error}</p>}
        <button className="button" type="submit" disabled={pending}>{pending ? 'Wird gespeichert…' : 'Passwort speichern'}</button>
      </form>
    </PageShell>
  );
}
