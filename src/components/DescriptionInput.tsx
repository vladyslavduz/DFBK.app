import { useEffect, useState } from 'react';
import AppIcon from './AppIcon';

type Props = { value: string; onChange: (value: string) => void; onBack: () => void; onContinue: () => void };

export default function DescriptionInput({ value, onChange, onBack, onContinue }: Props) {
  const [recording, setRecording] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');

  useEffect(() => {
    if (!recording) return;
    const timer = window.setTimeout(() => {
      setRecording(false);
      setVoiceNote('Sprachaufnahme erfasst – die automatische Transkription wird später verbunden.');
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [recording]);

  return (
    <section className="wizard-card description-step">
      <div className="wizard-heading"><span className="app-kicker">Schritt 2</span><h1>Erzähl uns kurz von deiner Arbeit</h1><p>Ein paar einfache Informationen reichen aus.</p></div>
      <label className="description-field">Text schreiben<textarea value={value} onChange={event => onChange(event.target.value)} placeholder="Was wurde gemacht? Was ist besonders wichtig?" autoFocus /></label>
      <div className="voice-panel">
        <div><strong>Oder Sprache verwenden</strong><span>Sprich so, wie du es einem Kunden erklären würdest.</span></div>
        <button className={`voice-button${recording ? ' is-recording' : ''}`} type="button" onClick={() => setRecording(current => !current)} aria-pressed={recording}><AppIcon name="mic" /><span>{recording ? 'Aufnahme läuft…' : 'Aufnahme starten'}</span></button>
      </div>
      {voiceNote && <p className="inline-notice" role="status">{voiceNote}</p>}
      <div className="wizard-footer"><button className="text-button" type="button" onClick={onBack}>Zurück</button><button className="button" type="button" disabled={!value.trim() && !voiceNote} onClick={onContinue}>Content erstellen<AppIcon name="arrow" /></button></div>
    </section>
  );
}
