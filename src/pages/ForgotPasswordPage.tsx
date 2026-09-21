import { useState, type FormEvent } from 'react';
import AppLink from '../components/AppLink';
import PageShell from '../components/PageShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return <PageShell eyebrow="Konto" title="Passwort zurücksetzen" intro="Gib die E-Mail-Adresse deines DFBK.app Kontos ein."><form className="form-card" onSubmit={submit}><label>E-Mail-Adresse<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@betrieb.de" required /></label>{submitted && <p className="auth-demo-message" role="status">Die Oberfläche ist bereit. Der sichere Versand des Reset-Links wird aktiviert, sobald der zugehörige Backend-Endpunkt verfügbar ist.</p>}<button className="button" type="submit">Reset-Link anfordern</button><p className="form-note"><AppLink to="/login">Zurück zur Anmeldung</AppLink></p></form></PageShell>;
}
