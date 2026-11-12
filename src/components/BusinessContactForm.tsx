import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

type Widget = {
  render(container: HTMLElement, options: {
    sitekey: string;
    action: string;
    size: 'normal' | 'compact';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }): string;
  remove(id: string): void;
  reset(id: string): void;
};

const browser = window as Window & { turnstile?: Widget };
let widgetLoad: Promise<Widget> | undefined;

function loadWidget(): Promise<Widget> {
  if (browser.turnstile) return Promise.resolve(browser.turnstile);
  widgetLoad ??= new Promise<Widget>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error('Turnstile unavailable'));
    };
    const timeout = window.setTimeout(fail, 10000);
    script.onerror = fail;
    script.onload = () => {
      window.clearTimeout(timeout);
      if (browser.turnstile) resolve(browser.turnstile);
      else fail();
    };
    document.head.append(script);
  }).catch(error => {
    widgetLoad = undefined;
    throw error;
  });
  return widgetLoad;
}

export default function BusinessContactForm({ siteKey }: { siteKey: string }) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const pending = useRef(false);
  const [token, setToken] = useState('');
  const [state, setState] = useState<'ready' | 'sending' | 'sent'>('ready');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void loadWidget().then(api => {
      if (!active || !container.current) return;
      widget.current = api.render(container.current, {
        sitekey: siteKey,
        action: 'business_contact',
        size: container.current.clientWidth < 300 ? 'compact' : 'normal',
        callback: value => { if (active) setToken(value); },
        'expired-callback': () => { if (active) setToken(''); },
        'error-callback': () => {
          if (active) {
            setToken('');
            setError('Der Spamschutz konnte nicht geladen werden. Du kannst uns per E-Mail erreichen.');
          }
        },
      });
    }).catch(() => {
      if (active) setError('Der Spamschutz ist derzeit nicht verfügbar. Du kannst uns per E-Mail erreichen.');
    });
    return () => {
      active = false;
      if (widget.current !== undefined) browser.turnstile?.remove(widget.current);
      widget.current = undefined;
    };
  }, [siteKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !token || state === 'sent') return;
    pending.current = true;
    const fields = new FormData(event.currentTarget);
    setState('sending');
    setError('');
    try {
      const result = await fetch('/api/business-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fields.get('email'), message: fields.get('message'), token }),
      });
      if (result.ok && (await result.json()).ok === true) {
        setState('sent');
      } else {
        setState('ready');
        setError(result.status === 429
          ? 'Zu viele Anfragen. Bitte warte eine Minute.'
          : 'Die Anfrage konnte nicht gesendet werden. Bitte prüfe die Eingaben oder schreibe uns per E-Mail.');
      }
    } catch {
      setState('ready');
      setError('Der Versand konnte nicht bestätigt werden. Bitte prüfe deine Verbindung.');
    } finally {
      pending.current = false;
      setToken('');
      if (widget.current !== undefined) browser.turnstile?.reset(widget.current);
    }
  }

  return (
    <form className="payment-info__form" onSubmit={submit}>
      <div hidden={state === 'sent'}>
        <label htmlFor={id + '-email'}>Deine E-Mail-Adresse</label>
        <input id={id + '-email'} name="email" type="email" autoComplete="email" required maxLength={254} />
        <label htmlFor={id + '-message'}>Deine Nachricht</label>
        <textarea id={id + '-message'} name="message" rows={4} required minLength={10} maxLength={2000} />
        <div ref={container} className="payment-info__challenge" />
        <p><a href="/datenschutz">Datenschutzhinweise</a></p>
        <button type="submit" className="button" disabled={!token || state === 'sending'}>
          {state === 'sending' ? 'Wird gesendet …' : 'Anfrage senden'}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {state === 'sent' && <p role="status">Deine Anfrage wurde gesendet.</p>}
    </form>
  );
}
