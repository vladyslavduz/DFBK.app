import { useEffect, useRef, useState, type FormEvent } from 'react';
import AppIcon from '../components/AppIcon';
import { useAuth } from '../contexts/AuthContext';
import { useUserArea } from '../contexts/UserAreaContext';
import { ApiError } from '../lib/api';
import { adminService, type AdminPlan, type AdminUser } from '../services/admin';

type SearchState = 'idle' | 'searching' | 'found' | 'not-found' | 'error';

const planLabel: Record<AdminPlan, string> = {
  trial: 'Testzugang',
  business: 'Business',
};

const roleLabel = {
  user: 'Nutzer',
  admin: 'Administrator',
} as const;

const sourceLabel = {
  system: 'System',
  manual_admin: 'Manuell durch Admin',
  stripe: 'Stripe',
} as const;

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatBerlinTimestamp(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  }).format(parsed);
}

function adminErrorMessage(error: unknown, context: 'search' | 'mutation') {
  if (!(error instanceof ApiError)) return 'Die Verbindung zum Server wurde unterbrochen.';
  if (error.code === 'USER_NOT_FOUND') return 'Kein Nutzer mit dieser E-Mail-Adresse gefunden.';
  if (error.code === 'INVALID_PLAN') return 'Ungültiger Tarif.';
  if (error.code === 'INVALID_ORIGIN') return 'Die Änderung wurde aus Sicherheitsgründen abgelehnt. Bitte lade die Seite neu und versuche es erneut.';
  if (['INVALID_TRIAL_EXPIRATION', 'TRIAL_EXPIRATION_CHANGE_NOT_SUPPORTED', 'INVALID_CONTENT_TYPE', 'REQUEST_TOO_LARGE', 'INVALID_REQUEST'].includes(error.code)) return 'Die Anfrage entspricht nicht dem erwarteten Admin-Vertrag.';
  if (error.code === 'PLAN_UPDATE_FAILED') return 'Tarif konnte nicht aktualisiert werden.';
  if (error.status === 401) return 'Deine Sitzung ist nicht mehr gültig.';
  if (error.status === 403) return 'Du hast keinen Zugriff auf diese Admin-Funktion.';
  return context === 'search' ? 'Der Nutzer konnte nicht geladen werden.' : 'Tarif konnte nicht aktualisiert werden.';
}

export default function AdminPage() {
  const { user: currentUser, refresh } = useAuth();
  const { reloadPlan } = useUserArea();
  const [email, setEmail] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<AdminPlan>('trial');
  const [message, setMessage] = useState('');
  const [mutationPending, setMutationPending] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [statusUncertain, setStatusUncertain] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const searchRequestId = useRef(0);
  const mutationId = useRef(0);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmOpen) return;
    requestAnimationFrame(() => confirmButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmOpen]);

  useEffect(() => {
    return () => {
      searchRequestId.current += 1;
      mutationId.current += 1;
    };
  }, []);

  function clearTarget() {
    setTarget(null);
    setSelectedPlan('trial');
    setMessage('');
    setConfirmOpen(false);
    setStatusUncertain(false);
  }

  async function searchExact(normalizedEmail: string, mode: 'normal' | 'verify' = 'normal') {
    const requestId = ++searchRequestId.current;
    if (mode === 'normal') {
      clearTarget();
      setSearchState('searching');
    } else {
      setVerificationPending(true);
    }

    try {
      const found = await adminService.findUserByEmail(normalizedEmail);
      if (requestId !== searchRequestId.current) return null;
      setTarget(found);
      setSelectedPlan(found.plan);
      setStatusUncertain(false);
      setSearchState('found');
      if (mode === 'verify') setMessage('Serverstatus wurde erneut geladen.');
      return found;
    } catch (error) {
      if (requestId !== searchRequestId.current) return null;
      if (mode === 'normal') setTarget(null);
      if (mode === 'verify') setStatusUncertain(true);
      if (error instanceof ApiError && error.code === 'USER_NOT_FOUND') {
        setSearchState('not-found');
        setMessage('Kein Nutzer mit dieser E-Mail-Adresse gefunden.');
      } else if (error instanceof ApiError && error.status === 401) {
        setTarget(null);
        setStatusUncertain(false);
        setSearchState('error');
        setMessage('Deine Sitzung ist nicht mehr gültig. Bitte melde dich erneut an.');
        await refresh();
      } else if (error instanceof ApiError && error.status === 403) {
        setTarget(null);
        setStatusUncertain(false);
        setSearchState('error');
        setMessage('Du hast keinen Zugriff auf diese Admin-Funktion.');
      } else {
        if (mode === 'normal') setSearchState('error');
        setMessage(adminErrorMessage(error, 'search'));
      }
      return null;
    } finally {
      if (requestId === searchRequestId.current) setVerificationPending(false);
    }
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (mutationPending || verificationPending) return;
    const normalized = email.trim().toLowerCase();
    setEmail(normalized);
    if (!normalized || normalized.length > 254 || !validEmail(normalized)) {
      clearTarget();
      setSearchState('error');
      setMessage('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }
    await searchExact(normalized);
  }

  async function applyPlanChange() {
    if (!target || selectedPlan === target.plan || mutationPending || verificationPending) return;
    const fixedTarget = { id: target.id, email: target.email };
    const requestId = ++mutationId.current;
    setConfirmOpen(false);
    setMutationPending(true);
    setMessage('');

    try {
      const result = await adminService.changePlan(fixedTarget.id, selectedPlan);
      if (requestId !== mutationId.current) return;
      setTarget(result.user);
      setSelectedPlan(result.user.plan);
      setSearchState('found');
      setMessage(result.changed ? 'Tarif wurde aktualisiert.' : 'Der Tarif ist bereits aktuell.');

      if (currentUser?.id === result.user.id) {
        await refresh();
        await reloadPlan();
      }
    } catch (error) {
      if (requestId !== mutationId.current) return;
      if (error instanceof ApiError && error.status === 401) {
        clearTarget();
        setSearchState('error');
        setMessage('Deine Sitzung ist nicht mehr gültig. Bitte melde dich erneut an.');
        await refresh();
      } else if (error instanceof ApiError && error.status === 403) {
        clearTarget();
        setSearchState('error');
        setMessage('Du hast keinen Zugriff auf diese Admin-Funktion.');
      } else if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        setMessage(adminErrorMessage(error, 'mutation'));
      } else {
        setMessage('Das Ergebnis der Änderung ist unklar. Der Serverstatus wird erneut geprüft.');
        setVerificationPending(true);
        const verified = await searchExact(fixedTarget.email, 'verify');
        if (!verified && requestId === mutationId.current) {
          setStatusUncertain(true);
          setSearchState('found');
          setMessage('Das Ergebnis der Änderung konnte nicht bestätigt werden. Bitte prüfe den Status erneut.');
        }
      }
    } finally {
      if (requestId === mutationId.current) setMutationPending(false);
    }
  }

  const controlsLocked = mutationPending || verificationPending || searchState === 'searching' || statusUncertain;
  const canChange = Boolean(target && selectedPlan !== target.plan && !controlsLocked);

  return (
    <div className="app-page admin-page">
      <header className="app-page-heading">
        <span className="app-kicker">Administration</span>
        <h1>Nutzer suchen und Tarif verwalten</h1>
        <p>Tarife werden manuell über den bestehenden DFBK.app Account geändert. Rollen bleiben unverändert.</p>
      </header>

      <section className="admin-card">
        <form className="admin-search-form" onSubmit={submitSearch}>
          <label htmlFor="admin-user-email">E-Mail-Adresse</label>
          <div>
            <input id="admin-user-email" type="email" inputMode="email" autoComplete="off" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="user@example.com" disabled={mutationPending || verificationPending} />
            <button className="button" type="submit" disabled={mutationPending || verificationPending || searchState === 'searching'}>{searchState === 'searching' ? 'Suche …' : 'Nutzer suchen'}</button>
          </div>
        </form>
        {message && <p className="admin-message" role="status" aria-live="polite">{message}</p>}
      </section>

      {target && searchState === 'found' && (
        <section className="admin-card admin-user-card" aria-label="Gefundener Nutzer">
          <div className="admin-user-heading">
            <div><span className="app-kicker">Gefundener Nutzer</span><h2>{target.email}</h2><small>{target.id}</small></div>
            <span className="admin-plan-badge">{planLabel[target.plan]}</span>
          </div>

          <dl className="admin-user-details">
            <div><dt>Rolle</dt><dd>{roleLabel[target.role]}</dd></div>
            <div><dt>Tarif</dt><dd>{planLabel[target.plan]}</dd></div>
            <div><dt>Quelle</dt><dd>{sourceLabel[target.planSource]}</dd></div>
            <div><dt>Testzugang bis</dt><dd>{formatBerlinTimestamp(target.trialExpiresAt) || 'Kein Ablaufdatum hinterlegt'}</dd></div>
            <div><dt>Tarif aktualisiert</dt><dd>{formatBerlinTimestamp(target.planUpdatedAt) || 'Noch keine manuelle Änderung'}</dd></div>
            <div><dt>Konto erstellt</dt><dd>{formatBerlinTimestamp(target.createdAt) || target.createdAt}</dd></div>
          </dl>

          <div className="admin-plan-control">
            <label htmlFor="admin-plan-select">Tarif auswählen</label>
            <select id="admin-plan-select" value={selectedPlan} onChange={event => setSelectedPlan(event.target.value as AdminPlan)} disabled={controlsLocked}>
              <option value="trial">Testzugang</option>
              <option value="business">Business</option>
            </select>
            <button className="button" type="button" disabled={!canChange} onClick={() => setConfirmOpen(true)}>{mutationPending ? 'Wird aktualisiert …' : 'Tarif ändern'}</button>
            {verificationPending && <button className="button button-secondary" type="button" disabled>Status wird geprüft …</button>}
          </div>

          {statusUncertain && (
            <button className="button button-secondary admin-recheck-button" type="button" disabled={mutationPending || verificationPending} onClick={() => void searchExact(target.email, 'verify')}>Status erneut prüfen</button>
          )}
        </section>
      )}

      {searchState === 'not-found' && <section className="admin-empty-state"><AppIcon name="user" /><strong>Kein Nutzer gefunden</strong><p>Kein Nutzer mit dieser E-Mail-Adresse gefunden.</p></section>}

      <aside className="admin-security-note">
        <strong>Sicherheitshinweis</strong>
        <p>Für breitere produktive Nutzung bleibt verpflichtende MFA / Passkey für Administratoren ein offener Security-Schritt.</p>
      </aside>

      {confirmOpen && target && (
        <div className="admin-confirm-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setConfirmOpen(false)}>
          <section className="admin-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
            <h2 id="admin-confirm-title">Tarif ändern?</h2>
            <p>Tarif für <strong>{target.email}</strong> von {planLabel[target.plan]} auf {planLabel[selectedPlan]} ändern?</p>
            <div>
              <button className="button button-secondary" type="button" onClick={() => setConfirmOpen(false)}>Abbrechen</button>
              <button ref={confirmButtonRef} className="button" type="button" onClick={() => void applyPlanChange()}>Änderung bestätigen</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
