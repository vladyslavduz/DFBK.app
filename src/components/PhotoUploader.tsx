import { useRef } from 'react';
import AppIcon from './AppIcon';

type Props = { preview: string; onSelect: (file: File) => void; onContinue: () => void };

export default function PhotoUploader({ preview, onSelect, onContinue }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  function selectFile(files: FileList | null) {
    const file = files?.[0];
    if (file) onSelect(file);
  }

  return (
    <section className="wizard-card photo-step">
      <div className="wizard-heading"><span className="app-kicker">Schritt 1</span><h1>Foto hinzufügen</h1><p>Zeig uns die Arbeit, die du sichtbar machen möchtest.</p></div>
      {preview ? (
        <div className="photo-preview"><img src={preview} alt="Vorschau der ausgewählten Arbeit" /><button className="button button-secondary" type="button" onClick={() => uploadRef.current?.click()}><AppIcon name="image" />Foto ändern</button></div>
      ) : (
        <div className="photo-actions">
          <button className="photo-action is-primary" type="button" onClick={() => cameraRef.current?.click()}><span><AppIcon name="camera" /></span><strong>Foto aufnehmen</strong><small>Direkt mit dem Smartphone</small></button>
          <button className="photo-action" type="button" onClick={() => uploadRef.current?.click()}><span><AppIcon name="upload" /></span><strong>Foto hochladen</strong><small>Vorhandenes Bild auswählen</small></button>
        </div>
      )}
      <input ref={cameraRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={event => selectFile(event.target.files)} />
      <input ref={uploadRef} className="visually-hidden" type="file" accept="image/*" onChange={event => selectFile(event.target.files)} />
      <div className="wizard-footer"><span>{preview ? 'Foto ausgewählt' : 'Eine Hauptaufnahme reicht für den Start.'}</span><button className="button" type="button" disabled={!preview} onClick={onContinue}>Weiter<AppIcon name="arrow" /></button></div>
    </section>
  );
}
