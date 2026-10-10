import AppLink from '../components/AppLink';
import PageShell from '../components/PageShell';

export default function ForgotPasswordPage() {
  return (
    <PageShell
      eyebrow="Konto"
      title="Passwort zurücksetzen"
      intro="Die Passwort-Wiederherstellung ist derzeit noch nicht verfügbar."
    >
      <section className="form-card" aria-labelledby="forgot-password-status">
        <h2 id="forgot-password-status">Demnächst verfügbar</h2>
        <p>Der sichere Versand eines Reset-Links wird erst aktiviert, sobald der zugehörige Backend-Endpunkt verfügbar ist.</p>
        <button className="button" type="button" disabled title="Noch nicht verfügbar">Reset-Link · Demnächst</button>
        <p className="form-note"><AppLink to="/login">Zurück zur Anmeldung</AppLink></p>
      </section>
    </PageShell>
  );
}
