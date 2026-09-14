import PageShell from '../components/PageShell';

export default function RegisterPage() {
  return <PageShell eyebrow="Konto" title="Testzugang erstellen" intro="Registrierung, E-Mail-Bestätigung und Datenschutz-Einwilligung sind als nächster Auth-Schritt vorgesehen."><form className="form-card" onSubmit={e => e.preventDefault()}><label>Name<input placeholder="Max Mustermann" /></label><label>Betrieb<input placeholder="Muster Malerbetrieb" /></label><label>E-Mail<input type="email" /></label><label>Passwort<input type="password" /></label><label className="check-row"><input type="checkbox" /> <span>Datenschutz gelesen und akzeptiert.</span></label><button className="button" disabled>Konto erstellen — API noch nicht verbunden</button></form></PageShell>;
}
