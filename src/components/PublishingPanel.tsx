import { useEffect, useRef, useState } from 'react';
import { publishingChannels, type PublishingChannel } from '../config/publishing';
type Props = {
  title: string;
  imageUrl: string;
  texts: Record<PublishingChannel, string>;
  videoUrl?: string;
  squareVideoUrl?: string;
  onDirectPublish?: (channel: 'instagram' | 'facebook', text: string) => Promise<string>;
};
export default function PublishingPanel({ title, imageUrl, texts, videoUrl, squareVideoUrl, onDirectPublish }: Props) {
  const [selected, setSelected] = useState<PublishingChannel | null>(null);
  const [drafts, setDrafts] = useState(texts);
  const [file, setFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [format, setFormat] = useState<'video' | 'image'>(videoUrl ? 'video' : 'image');
  const [feedback, setFeedback] = useState('');
  const [square, setSquare] = useState(false);
  const activeVideo = square && squareVideoUrl ? squareVideoUrl : videoUrl;
  const [busy, setBusy] = useState(false);
  const selectionVersion = useRef(0);
  const [preparationVersion, setPreparationVersion] = useState(0);
  useEffect(() => { setDrafts(texts); }, [texts]);
  useEffect(() => {
    let active = true;
    if (!selected) return;
    setFile(null); setPreparing(true); setFeedback('');
    const mediaUrl = format === 'video' && activeVideo ? activeVideo : imageUrl;
    void fetch(mediaUrl, { credentials: mediaUrl.startsWith('/api/') ? 'same-origin' : 'omit' })
      .then(async response => {
        if (!response.ok) throw new Error();
        let blob = await response.blob();
        if (format === 'image' && blob.type.startsWith('image/') && blob.type !== 'image/jpeg') {
          const bitmap = await createImageBitmap(blob);
          try {
            const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
            const context = canvas.getContext('2d'); if (!context) throw new Error();
            context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0);
            blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error()), 'image/jpeg', 0.92));
          } finally { bitmap.close(); }
        }
        if (format === 'video' && !blob.type.startsWith('video/')) throw new Error();
        if (format === 'image' && !blob.type.startsWith('image/')) throw new Error();
        if (active) setFile(new File([blob], format === 'video' ? 'dfbk-beitrag.mp4' : 'dfbk-projektbild.' + (blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'), { type: blob.type }));
      }).catch(() => {
        if (!active) return;
        if (format === 'video') { setFormat('image'); setFeedback('Video nicht verfügbar. Bild und Text stehen bereit.'); }
        else setFeedback('Bild konnte nicht vorbereitet werden. Bitte erneut versuchen.');
      }).finally(() => { if (active) setPreparing(false); });
    return () => { active = false; };
  }, [selected, format, activeVideo, imageUrl, preparationVersion]);
  const channel = publishingChannels.find(item => item.id === selected);
  function choose(id: PublishingChannel) { selectionVersion.current++; setPreparationVersion(value => value + 1); setSelected(id); setSquare(['facebook', 'x', 'linkedin', 'google_business', 'website', 'email'].includes(id)); setFormat(videoUrl ? 'video' : 'image'); }
  async function share() {
    if (!selected || !file) return;
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      if (format === 'video') { setFormat('image'); setFeedback('Videodatei wird hier nicht unterstützt. Bild wird vorbereitet.'); }
      else setFeedback('Datei-Teilen ist hier nicht verfügbar. Lade das Bild herunter und kopiere den Text.');
      return;
    }
    const version = selectionVersion.current;
    try { await navigator.share({ title, text: drafts[selected], files: [file] }); if (version === selectionVersion.current) setFeedback('An das gewählte Systemziel übergeben. Dies bestätigt keine Veröffentlichung.'); }
    catch (error) {
      if (version !== selectionVersion.current || (error instanceof DOMException && error.name === 'AbortError')) return;
      setFeedback('Übergabe nicht abgeschlossen. Nutze Download und Text kopieren.');
    }
  }
  async function copy() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(drafts[selected]); setFeedback('Text kopiert.'); }
    catch { setFeedback('Bitte markiere und kopiere den Text im Textfeld.'); }
  }
  function download() {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setFeedback('Download angefordert. Datei im Zielkanal auswählen und Veröffentlichung dort bestätigen.');
  }
  return <section className="share-hub" aria-label="Veröffentlichung vorbereiten">
    <div className="share-hub__intro"><h2>Dein Material. Dein Kanal.</h2><p>Wähle einen Kanal, prüfe Bild und Text und bestätige die Übergabe oder Veröffentlichung.</p></div>
    <div className="mvp-integration-grid">{publishingChannels.map(item => <article className="mvp-integration-card" key={item.id}>
      <img src={'/visual/integrations/icons/' + item.icon} alt="" /><div><strong>{item.label}</strong><span>Beitrag für diesen Kanal vorbereiten</span></div>
      <button type="button" onClick={() => choose(item.id)} aria-pressed={selected === item.id}>Beitrag vorbereiten</button>
    </article>)}</div>
    {selected && channel && <div className="publishing-preview" aria-label={channel.label + ' Vorschau'}>
      <h3>{channel.label} · {title}</h3>
      {format === 'video' && videoUrl ? <video controls playsInline preload="metadata" poster={imageUrl} src={activeVideo} onError={() => setFormat('image')} /> : <img src={imageUrl} alt="Vorschau des ausgewählten Materials" />}
      {videoUrl && <div className="publishing-actions"><button type="button" onClick={() => { setSquare(false); setFormat('video'); }}>Video 9:16</button>{squareVideoUrl && <button type="button" onClick={() => { setSquare(true); setFormat('video'); }}>Video 1:1</button>}<button type="button" onClick={() => setFormat('image')}>Bild verwenden</button></div>}
      <label>Beitragstext für {channel.label}<textarea rows={7} value={drafts[selected]} onChange={event => setDrafts(current => ({ ...current, [selected]: event.target.value }))} /></label>
      <p>Beim System-Teilen wählst du das Ziel in deinem Gerät. Die Kanal-Schaltfläche kann keine bestimmte App erzwingen.</p>
      <div className="publishing-actions">
        <button className="button" type="button" disabled={preparing || !file || busy} onClick={() => void share()}>{preparing ? 'Datei wird vorbereitet …' : 'Datei und Text teilen'}</button>
        <button className="button button-secondary" type="button" onClick={() => void copy()}>Text kopieren</button>
        <button className="button button-secondary" type="button" disabled={!file || busy} onClick={download}>Datei herunterladen</button>
        {channel.url && <a className="button button-secondary" href={channel.url} target={selected === 'email' ? undefined : '_blank'} rel="noopener noreferrer">{channel.label} öffnen</a>}
        {onDirectPublish && (selected === 'instagram' || selected === 'facebook') && <button className="button" disabled={busy || !drafts[selected].trim()} type="button" onClick={async () => {
          if (!window.confirm('Diesen Beitrag jetzt auf dem verbundenen ' + channel.label + '-Konto veröffentlichen?')) return;
          setBusy(true);
          try { setFeedback(await onDirectPublish(selected, drafts[selected])); } catch { setFeedback('Ergebnis unklar. Prüfe den gespeicherten Versuch, bevor du erneut veröffentlichst.'); } finally { setBusy(false); }
        }}>Auf verbundenem Konto veröffentlichen</button>}
      </div>
      <p className="share-hub__note" role="status">{feedback}</p>
    </div>}
  </section>;
}
