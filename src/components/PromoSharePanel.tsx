import { useEffect, useRef, useState } from 'react';
import { publishingChannels, promoVideos, type PublishingChannel } from '../config/publishing';
import { cmsPlatforms, promoEmbedHtml, promoShareLink, promoShareText, promoShareTitle } from '../services/promo-share';

export default function PromoSharePanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const sharing = useRef(false);
  const [selected, setSelected] = useState<PublishingChannel>('instagram');
  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [format, setFormat] = useState<'photo' | 'video'>('photo');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [cms, setCms] = useState<string>('WordPress');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    setError(false);
    async function prepare(url: string, name: string, type: string) {
      const response = await fetch(url, { credentials: 'omit', signal: abort.signal });
      if (!response.ok || !response.headers.get('content-type')?.startsWith(type)) throw new Error();
      const blob = await response.blob();
      if (blob.size === 0 || blob.size > 20 * 1024 * 1024) throw new Error();
      return new File([blob], name, { type });
    }
    void prepare('/promo/dfbk-friseur.jpg', 'dfbk-friseur.jpg', 'image/jpeg')
      .then(file => { if (!abort.signal.aborted) setPhoto(file); })
      .catch(() => { if (!abort.signal.aborted) setError(true); });
    void prepare(promoVideos[0].url, 'dfbk-friseur.mp4', 'video/mp4')
      .then(file => { if (!abort.signal.aborted) setVideo(file); })
      .catch(() => { /* Photo remains available if video cannot be prepared. */ });
    return () => abort.abort();
  }, [retry]);

  function open(channel: PublishingChannel, trigger: HTMLElement) {
    if (!dialog.current?.open) { lastTrigger.current = trigger; setFormat('photo'); }
    setSelected(channel);
    setFeedback('');
    if (!dialog.current?.open) dialog.current?.showModal();
  }

  async function nativeShare(channel: PublishingChannel, file: File | null, trigger: HTMLElement) {
    if (sharing.current) return;
    if (!file || !navigator.share || !navigator.canShare?.({ files: [file] })) {
      open(channel, trigger);
      return;
    }
    // The file is prepared before the click; no awaited fetch consumes user activation.
    sharing.current = true;
    setBusy(true);
    try {
      await navigator.share({ title: promoShareTitle, text: promoShareText(channel), files: [file] });
      setFeedback('An das System-Teilen übergeben. Bestätige den Beitrag in der Ziel-App.');
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      open(channel, trigger);
      setFeedback('Die Datei konnte nicht übergeben werden. Nutze Download und Text kopieren.');
    } finally { sharing.current = false; setBusy(false); }
  }

  function close() {
    dialog.current?.close();
    lastTrigger.current?.focus();
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setFeedback('Kopiert. Im Ziel einfügen und dort bestätigen.'); }
    catch { setFeedback('Bitte markiere und kopiere den Text im Feld.'); }
  }
  function download(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url; link.download = file.name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setFeedback('Download angefordert. Die Datei im Ziel auswählen und den Beitrag dort bestätigen.');
  }
  const file = format === 'video' ? video : photo;

  return <section className="share-hub promo-share" aria-label="DFBK-Beispiel teilen">
    <div className="share-hub__intro"><h2>Dieses Beispiel teilen</h2><p>Teile unser Friseur-Beispiel ohne DFBK-Registrierung. Du bestätigst die Veröffentlichung in deinem eigenen Konto.</p></div>
    <div className="mvp-integration-grid">{publishingChannels.map(channel => {
      const href = promoShareLink(channel.id);
      return <article className="mvp-integration-card" key={channel.id}>
        <img src={'/visual/integrations/icons/' + channel.icon} alt="" />
        <div><strong>{channel.label}</strong><span>{channel.id === 'instagram' ? 'Foto oder Video über dein Gerät weitergeben.' : channel.id === 'website' ? 'Plattform wählen und Beispiel übernehmen.' : channel.id === 'google_business' ? 'Bild und Text für dein Unternehmensprofil übernehmen.' : 'Unser Beispiel im Teilen-Fenster weitergeben.'}</span></div>
        {href ? <a className="promo-share-link" href={href} target={channel.id === 'email' ? undefined : '_blank'} rel="noopener noreferrer" aria-label={channel.label + ': Beispiel teilen'}>Teilen</a>
          : <button type="button" disabled={busy} onClick={event => channel.id === 'instagram' ? void nativeShare(channel.id, photo, event.currentTarget) : open(channel.id, event.currentTarget)}>{channel.id === 'website' ? 'Plattform wählen' : channel.id === 'google_business' ? 'Übernehmen' : 'Teilen'}</button>}
      </article>;
    })}</div>
    <p className="share-hub__note">Facebook und andere Dienste bestimmen die Link-Vorschau selbst. Instagram wird im System-Menü gewählt, sofern dein Gerät es anbietet. Feed, Story oder Reel bestätigst du in der Ziel-App; ein Link-Aufruf bestätigt keinen veröffentlichten Beitrag.</p>
    <div className="publishing-actions"><button type="button" onClick={event => open('instagram', event.currentTarget)}>Foto oder Video auswählen</button></div>
    <p role="status" aria-live="polite">{feedback}</p>
    <dialog ref={dialog} className="promo-share-dialog" aria-labelledby="promo-share-heading" onClose={() => lastTrigger.current?.focus()}>
      <div className="publishing-actions"><button type="button" onClick={close}>Schließen</button></div>
      <h2 id="promo-share-heading">{selected === 'website' ? 'Auf deiner Website verwenden' : selected === 'google_business' ? 'Für dein Unternehmensprofil' : 'Für Instagram vorbereiten'}</h2>
      {selected === 'website' ? <>
        <label>Deine Plattform<select value={cms} onChange={event => setCms(event.target.value)}>{cmsPlatforms.map(name => <option key={name}>{name}</option>)}</select></label>
        <p>Öffne deinen Editor in {cms}. Übernimm das Beispiel als Bild und Text oder füge den HTML-Code in einen dafür vorgesehenen Bereich ein. Das ist eine manuelle Übernahme; dein Website-Konto wird nicht verbunden.</p>
        <label>HTML-Beispiel<textarea aria-label="HTML-Beispiel" readOnly rows={9} value={promoEmbedHtml} /></label>
        <button className="button button-secondary" type="button" onClick={() => void copy(promoEmbedHtml)}>HTML kopieren</button>
      </> : <p>Wähle {selected === 'instagram' ? 'Instagram' : 'dein Unternehmensprofil'} als Ziel. Die Ziel-App bestimmt, welche Formate verfügbar sind. Je nach App musst du den Text separat einfügen.</p>}
      <label>Material<select value={format} onChange={event => setFormat(event.target.value as 'photo' | 'video')}><option value="photo">Foto + Text</option><option value="video">Video + Text</option></select></label>
      <img className="promo-dialog-image" src="/promo/dfbk-friseur.jpg" alt="DFBK-Werbebeispiel aus einem Friseurfoto" />
      <label>Beschreibung<textarea aria-label="Beschreibung" readOnly rows={6} value={promoShareText(selected)} /></label>
      <div className="publishing-actions">
        <button className="button" type="button" disabled={!file || busy} onClick={event => void nativeShare(selected, file, event.currentTarget)}>Datei und Text teilen</button>
        <button className="button button-secondary" type="button" disabled={!file} onClick={() => download(file)}>Datei herunterladen</button>
        <button className="button button-secondary" type="button" onClick={() => void copy(promoShareText(selected))}>Text kopieren</button>
        {selected === 'instagram' && <a className="button button-secondary" href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer">Instagram öffnen</a>}
        {selected === 'google_business' && <a className="button button-secondary" href="https://business.google.com/" target="_blank" rel="noopener noreferrer">Unternehmensprofil öffnen</a>}
      </div>
      {!file && <p role="status">{error ? 'Foto konnte nicht geladen werden.' : format === 'video' ? 'Video wird vorbereitet. Du kannst auch das Foto wählen.' : 'Foto wird vorbereitet …'}</p>}
      {error && <button type="button" onClick={() => setRetry(value => value + 1)}>Erneut laden</button>}
      <p role="status" aria-live="polite">{feedback}</p>
    </dialog>
  </section>;
}
