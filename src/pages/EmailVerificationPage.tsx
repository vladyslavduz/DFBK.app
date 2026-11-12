import AppLink from '../components/AppLink';
import AuthEmailForm from '../components/AuthEmailForm';
import PageShell from '../components/PageShell';

export default function EmailVerificationPage() {
  const status = new URLSearchParams(window.location.search).get('status');
  if (status === 'success') {
    return (
      <PageShell eyebrow="Konto" title="E-Mail bestätigt" intro="Du kannst dich jetzt mit deinem Passwort anmelden.">
        <AppLink className="button" to="/login">Zur Anmeldung</AppLink>
      </PageShell>
    );
  }

  const intro = status === 'expired'
    ? 'Dein Bestätigungslink ist abgelaufen. Fordere einen neuen Link an.'
    : status === 'invalid'
      ? 'Dieser Bestätigungslink ist ungültig. Fordere einen neuen Link an.'
      : status === 'error'
        ? 'Die Bestätigung konnte gerade nicht verarbeitet werden. Versuche es später erneut.'
        : 'Öffne den Link in deiner Bestätigungs-E-Mail. Bei Bedarf kannst du hier einen neuen Link anfordern.';
  return (
    <PageShell eyebrow="Konto" title="E-Mail-Adresse bestätigen" intro={intro}>
      <AuthEmailForm verification />
      <p className="form-note"><AppLink to="/login">Zur Anmeldung</AppLink></p>
    </PageShell>
  );
}
