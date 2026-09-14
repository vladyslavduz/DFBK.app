import PageShell from '../components/PageShell';
import AppLink from '../components/AppLink';

export default function LoginPage() {
  return <PageShell eyebrow="Konto" title="Anmelden" intro="Der Login ist vorbereitet. Die Authentifizierung wird später serverseitig angeschlossen."><form className="form-card" onSubmit={e => e.preventDefault()}><label>E-Mail<input type="email" placeholder="name@betrieb.de" /></label><label>Passwort<input type="password" placeholder="••••••••" /></label><button className="button" disabled>Anmelden — API noch nicht verbunden</button><p className="form-note"><AppLink to="/forgot-password">Passwort vergessen?</AppLink> · <AppLink to="/register">Konto erstellen</AppLink></p></form></PageShell>;
}
