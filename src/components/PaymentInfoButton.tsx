import { useId, useRef } from 'react';
import '../styles/payment-info.css';

export default function PaymentInfoButton({className='button'}:{className?:string}) {
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),heading=useId();
 return <><button ref={trigger} className={className} type="button" onClick={()=>dialog.current?.showModal()}>Informationen zum Business-Tarif</button>
 <dialog ref={dialog} className="payment-info" aria-labelledby={heading} onClose={()=>trigger.current?.focus()}>
  <h2 id={heading}>DFBK.app befindet sich in Entwicklung</h2>
  <p>Zahlungen sind derzeit nicht möglich.</p>
  <p>Bei Fragen wende dich bitte an den Betreiber.</p>
  <div className="payment-info__actions"><a className="button button-secondary" href="/impressum">Impressum und Kontakt</a><button className="button" type="button" autoFocus onClick={()=>dialog.current?.close()}>Schließen</button></div>
 </dialog></>;
}
