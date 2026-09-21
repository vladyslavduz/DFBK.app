import { useState } from 'react';
import AppLink from '../components/AppLink';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AppIcon from '../components/AppIcon';

export default function EmailVerificationPage() {
  const params = new URLSearchParams(window.location.search);
  const successful = params.get('status') === 'success';
  const email = params.get('email') || '';
  const [status, setStatus] = useState('');
  return <><Header /><main className="verification-page"><section className="verification-page-card"><span className={`verification-page-icon${successful ? ' is-success' : ''}`}>{successful ? <AppIcon name="check" /> : '✉'}</span><span className="app-kicker">DFBK.app Konto</span><h1>{successful ? 'E-Mail bestätigt' : 'Bestätige deine E-Mail-Adresse'}</h1><p>{successful ? 'Dein Konto ist bereit. Du kannst dich jetzt anmelden und dein erstes Projekt erstellen.' : 'Wir haben dir eine E-Mail mit einem Bestätigungslink geschickt.'}</p>{email && <strong>{email}</strong>}{status && <p className="inline-notice">{status}</p>}{successful ? <AppLink className="button" to="/app">Zum persönlichen Bereich</AppLink> : <><button className="button" type="button" onClick={() => setStatus('Die erneute Zustellung wird nach dem Backend-Anschluss aktiviert.')}>E-Mail erneut senden</button><AppLink className="text-button" to="/">Zurück zur Startseite</AppLink></>}</section></main><Footer /></>;
}
