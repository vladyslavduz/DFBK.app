import AppLink from '../components/AppLink';
import AuthEmailForm from '../components/AuthEmailForm';
import PageShell from '../components/PageShell';

export default function ForgotPasswordPage() {
  return (
    <PageShell eyebrow="Konto" title="Passwort vergessen?" intro="Fordere einen Link an, um ein neues Passwort zu setzen.">
      <AuthEmailForm />
      <p className="form-note"><AppLink to="/login">Zurück zur Anmeldung</AppLink></p>
    </PageShell>
  );
}
