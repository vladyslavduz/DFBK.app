import { useEffect, useId, useRef, useState } from 'react';
import BusinessContactForm from './BusinessContactForm';
import '../styles/payment-info.css';

const contactEmail = 'dfbk.app@gmail.com';

export default function PaymentInfoButton({ className = 'button' }: { className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useId();
  const [open, setOpen] = useState(false);
  const [siteKey, setSiteKey] = useState<string | null | undefined>();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch('/api/business-contact', { signal: controller.signal })
      .then(async result => result.ok ? (await result.json()).siteKey : null)
      .then(key => { if (!controller.signal.aborted) setSiteKey(typeof key === 'string' && key ? key : null); })
      .catch(() => { if (!controller.signal.aborted) setSiteKey(null); });
    return () => controller.abort();
  }, [open]);

  return (
    <>
      <button ref={trigger} className={className} type="button" onClick={() => {
        setSiteKey(undefined);
        dialog.current?.showModal();
        setOpen(true);
      }}>Informationen zum Business-Tarif</button>
      <dialog ref={dialog} className="payment-info" aria-labelledby={heading} onClose={() => {
        setOpen(false);
        trigger.current?.focus();
      }}>
        <h2 id={heading}>DFBK.app befindet sich in Entwicklung</h2>
        <p>Zahlungen sind derzeit nicht möglich.</p>
        <p>Du interessierst dich für Business? Schreib uns an <a href={'mailto:' + contactEmail}>{contactEmail}</a>.</p>
        {open && siteKey === undefined && <p role="status">Kontaktformular wird geladen …</p>}
        {open && siteKey === null && <p>Du erreichst uns derzeit direkt per E-Mail.</p>}
        {open && siteKey && <BusinessContactForm siteKey={siteKey} />}
        <div className="payment-info__actions">
          <a className="button button-secondary" href="/impressum">Impressum und Kontakt</a>
          <button className="button" type="button" autoFocus onClick={() => dialog.current?.close()}>Schließen</button>
        </div>
      </dialog>
    </>
  );
}
