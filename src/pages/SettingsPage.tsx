import { useState, type FormEvent } from 'react';
import AppIcon from '../components/AppIcon';
import { useAuth } from '../contexts/AuthContext';
import { useUserArea } from '../contexts/UserAreaContext';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { profile, updateProfile } = useUserArea();
  const [name, setName] = useState(profile.name);
  const [company, setCompany] = useState(profile.company);
  const [saved, setSaved] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    updateProfile({ name, company });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="app-page settings-page">
      <header className="app-page-heading"><span className="app-kicker">Profil & Einstellungen</span><h1>Dein Konto</h1><p>Nur die wichtigsten Angaben für deine Arbeit mit DFBK.app.</p></header>
      <section className="settings-card"><div className="settings-card-heading"><span><AppIcon name="user" /></span><div><h2>Persönliche Daten</h2><p>Name, Unternehmen und E-Mail-Adresse.</p></div></div><form className="settings-form" onSubmit={submit}><label>Name<input value={name} onChange={event => setName(event.target.value)} placeholder="Vor- und Nachname" /></label><label>Unternehmen<input value={company} onChange={event => setCompany(event.target.value)} placeholder="Name deines Betriebs" /></label><label>E-Mail<input value={user?.email || ''} readOnly /></label><button className="button" type="submit">{saved ? 'Gespeichert ✓' : 'Änderungen speichern'}</button></form></section>
      <section className="settings-card"><div className="settings-card-heading"><span><AppIcon name="settings" /></span><div><h2>Anmeldung</h2><p>So kannst du dich bei DFBK.app anmelden.</p></div></div><div className="account-methods"><div><b>Google</b><span>Verfügbar über Google OAuth</span><small>Bereit</small></div><div><b>Apple</b><span>Oberfläche vorbereitet</span><small className="is-muted">Noch nicht verbunden</small></div><div><b>E-Mail</b><span>{user?.email}</span><small>Aktiv</small></div></div><button className="button button-secondary" type="button" disabled>Passwort ändern</button><p className="settings-hint">Die Passwortänderung wird nach dem entsprechenden Backend-Endpunkt aktiviert.</p></section>
      <section className="settings-card account-actions"><div><h2>Konto</h2><p>Du kannst dich auf diesem Gerät sicher abmelden.</p></div><button className="button button-secondary" type="button" onClick={() => void logout()}><AppIcon name="logout" />Abmelden</button><button className="danger-button" type="button" disabled>Konto löschen</button></section>
    </div>
  );
}
