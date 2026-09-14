import PageShell from '../components/PageShell';

export default function ForgotPasswordPage() {
  return <PageShell eyebrow="Konto" title="Passwort zurücksetzen" intro="Später versendet DFBK hier eine zeitlich begrenzte Reset-E-Mail."><form className="form-card" onSubmit={e => e.preventDefault()}><label>E-Mail<input type="email" /></label><button className="button" disabled>Reset-Link senden — E-Mail-API fehlt</button></form></PageShell>;
}
