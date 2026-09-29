import { useEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { appConfig } from '../config/app';

type Props = { value: string; onChange: (value: string) => void; onBack: () => void; onContinue: () => void };

const SPEECH_LANGUAGES = [
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'en-US', label: 'English' },
  { value: 'ru-RU', label: 'Русский' },
] as const;

type SpeechState = 'idle' | 'recording' | 'unsupported' | 'error';

function speechConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function DescriptionInput({ value, onChange, onBack, onContinue }: Props) {
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const [speechLanguage, setSpeechLanguage] = useState<(typeof SPEECH_LANGUAGES)[number]['value']>('de-DE');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechMessage, setSpeechMessage] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const baseTextRef = useRef('');
  const finalTranscriptRef = useRef('');
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  function stopSpeech() {
    recognitionRef.current?.stop();
    setSpeechState('idle');
    setInterimTranscript('');
    setSpeechMessage('');
  }

  function startSpeech() {
    const Recognition = speechConstructor();
    if (!Recognition) {
      setSpeechState('unsupported');
      setSpeechMessage('Dein Browser unterstützt die Spracheingabe hier nicht. Du kannst den Text direkt eingeben.');
      return;
    }

    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.lang = speechLanguage;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    baseTextRef.current = valueRef.current.trimEnd();
    finalTranscriptRef.current = '';
    setInterimTranscript('');
    setSpeechMessage('Sprich jetzt – der Text erscheint direkt oben im Feld.');
    setSpeechState('recording');
    recognition.onstart = () => setSpeechState('recording');
    recognition.onresult = event => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) finalTranscriptRef.current += `${transcript.trim()} `;
        else interim += transcript;
      }

      const finalText = finalTranscriptRef.current.trim();
      const baseText = baseTextRef.current;
      onChange([baseText, finalText].filter(Boolean).join(`${baseText ? '\n' : ''}`));
      setInterimTranscript(interim.trim());
    };
    recognition.onerror = event => {
      setSpeechState('error');
      setInterimTranscript('');
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setSpeechMessage('Mikrofonzugriff wurde nicht erlaubt. Bitte erlaube ihn in den Browser-Einstellungen.');
      } else if (event.error === 'no-speech') {
        setSpeechMessage('Keine Sprache erkannt. Versuche es bitte noch einmal.');
      } else {
        setSpeechMessage('Die Spracheingabe konnte nicht gestartet werden. Du kannst den Text direkt eingeben.');
      }
    };
    recognition.onnomatch = () => setSpeechMessage('Ich konnte das Gesprochene nicht erkennen. Versuche es bitte noch einmal.');
    recognition.onend = () => {
      recognitionRef.current = null;
      setInterimTranscript('');
      setSpeechState(current => current === 'recording' ? 'idle' : current);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setSpeechState('error');
      setSpeechMessage('Die Spracheingabe konnte nicht gestartet werden.');
    }
  }

  const voiceAvailable = appConfig.features.voice;
  const speechLabel = speechState === 'recording' ? 'Aufnahme beenden' : 'Spracheingabe starten';

  return (
    <section className="wizard-card description-step">
      <div className="wizard-heading"><span className="app-kicker">Schritt 2</span><h1>Erzähl uns kurz von deiner Arbeit</h1><p>Ein paar einfache Informationen reichen aus.</p></div>
      <div className="description-field">
        <label htmlFor="project-description">Beschreibung</label>
        <div className="description-input-shell">
          <textarea id="project-description" value={value} onChange={event => onChange(event.target.value)} placeholder="Was wurde gemacht? Was ist besonders wichtig?" autoFocus />
          <div className="description-toolbar">
            <div className="description-voice-copy"><span>Schreiben oder sprechen</span>{voiceAvailable ? <span className="description-voice-hint">Sprache wird direkt in den Text übernommen.</span> : <span className="description-voice-hint">Spracheingabe ab einem passenden Tarif verfügbar.</span>}</div>
            <div className="description-voice-actions">
              <label className="speech-language"><span>Sprache</span><select value={speechLanguage} onChange={event => setSpeechLanguage(event.target.value as (typeof SPEECH_LANGUAGES)[number]['value'])} disabled={!voiceAvailable || speechState === 'recording'}>{SPEECH_LANGUAGES.map(language => <option value={language.value} key={language.value}>{language.label}</option>)}</select></label>
              <button className={`voice-button${speechState === 'recording' ? ' is-recording' : ''}`} type="button" onClick={speechState === 'recording' ? stopSpeech : startSpeech} disabled={!voiceAvailable} aria-pressed={speechState === 'recording'} title={voiceAvailable ? speechLabel : 'Spracheingabe ist in deinem aktuellen Tarif nicht verfügbar'}><AppIcon name="mic" /><span>{speechState === 'recording' ? 'Beenden' : 'Sprechen'}</span></button>
            </div>
          </div>
        </div>
      </div>
      {!voiceAvailable && <p className="voice-access-note" role="status">Spracheingabe ist in deinem aktuellen Tarif noch nicht freigeschaltet.</p>}
      {speechState === 'unsupported' && <p className="inline-notice" role="status">{speechMessage}</p>}
      {(speechState === 'recording' || speechState === 'error') && <p className="inline-notice" role="status">{speechMessage}{interimTranscript ? ` ${interimTranscript}` : ''}</p>}
      <div className="wizard-footer"><button className="text-button" type="button" onClick={onBack}>Zurück</button><button className="button" type="button" disabled={!value.trim()} onClick={onContinue}>Content erstellen<AppIcon name="arrow" /></button></div>
    </section>
  );
}
