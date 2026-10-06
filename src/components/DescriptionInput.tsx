import { useEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { useUserArea } from '../contexts/UserAreaContext';

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
  const { plan } = useUserArea();
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const [speechLanguage, setSpeechLanguage] = useState<(typeof SPEECH_LANGUAGES)[number]['value']>('de-DE');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechMessage, setSpeechMessage] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const baseTextRef = useRef('');
  const finalTranscriptRef = useRef('');
  const valueRef = useRef(value);
  const continueButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    requestAnimationFrame(() => continueButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && speechState !== 'recording') onBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack, speechState]);

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
    setSpeechMessage('Sprich jetzt – dein Zusatz wird direkt übernommen.');
    setSpeechState('recording');
    recognition.onstart = () => setSpeechState('recording');
    recognition.onresult = event => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) finalTranscriptRef.current += `${transcript.trim()} `;
        else interim += transcript;
      }

      const rawFinalText = finalTranscriptRef.current.trim();
      const finalText = plan.voice.maxWords ? rawFinalText.split(/\s+/).slice(0, plan.voice.maxWords).join(' ') : rawFinalText;
      const baseText = baseTextRef.current;
      onChange([baseText, finalText].filter(Boolean).join(baseText ? '\n' : ''));
      setInterimTranscript(interim.trim());
      if (plan.voice.maxWords && rawFinalText.split(/\s+/).filter(Boolean).length >= plan.voice.maxWords) {
        setSpeechMessage(`${plan.displayName}: maximal ${plan.voice.maxWords} Wörter pro Spracheingabe.`);
        recognition.stop();
      }
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

  const voiceAvailable = plan.voice.enabled;
  const hasAdditionalInfo = Boolean(value.trim());
  const speechLabel = speechState === 'recording' ? 'Aufnahme beenden' : 'Spracheingabe starten';

  return (
    <div className="optional-context-backdrop" role="presentation">
      <section className="optional-context-modal" role="dialog" aria-modal="true" aria-labelledby="optional-context-title" aria-describedby="optional-context-copy">
        <div className="optional-context-heading">
          <div>
            <span className="app-kicker">Optional</span>
            <h1 id="optional-context-title">Möchtest du noch etwas ergänzen?</h1>
            <p id="optional-context-copy">DFBK.app erkennt deine Arbeit auf dem Foto. Ergänze nur, was nicht sichtbar ist.</p>
          </div>
          <button className="optional-context-close" type="button" onClick={onBack} aria-label="Zurück zum Foto">×</button>
        </div>

        <div className="optional-context-field">
          <label htmlFor="project-description">Zusatzinfo</label>
          <textarea
            id="project-description"
            value={value}
            onChange={event => onChange(event.target.value)}
            placeholder="z. B. Material, Marke, Ort oder Besonderheit"
            rows={3}
          />
        </div>

        <div className="optional-context-tools">
          <label className="speech-language">
            <span>Sprache</span>
            <select
              value={speechLanguage}
              onChange={event => setSpeechLanguage(event.target.value as (typeof SPEECH_LANGUAGES)[number]['value'])}
              disabled={!voiceAvailable || speechState === 'recording'}
            >
              {SPEECH_LANGUAGES.map(language => <option value={language.value} key={language.value}>{language.label}</option>)}
            </select>
          </label>

          <button
            className={`voice-button${speechState === 'recording' ? ' is-recording' : ''}`}
            type="button"
            onClick={speechState === 'recording' ? stopSpeech : startSpeech}
            disabled={!voiceAvailable}
            aria-pressed={speechState === 'recording'}
            title={voiceAvailable ? speechLabel : 'Spracheingabe ist in deinem aktuellen Tarif nicht verfügbar'}
          >
            <AppIcon name="mic" />
            <span>{speechState === 'recording' ? 'Beenden' : 'Sprechen'}</span>
          </button>
        </div>

        {voiceAvailable && plan.voice.maxWords && <p className="optional-context-hint">{plan.displayName}: maximal {plan.voice.maxWords} Wörter pro Spracheingabe.</p>}
        {!voiceAvailable && <p className="optional-context-hint">Spracheingabe ist im {plan.displayName} noch nicht verfügbar.</p>}
        {(speechState === 'unsupported' || speechState === 'recording' || speechState === 'error') && (
          <p className="inline-notice" role="status">{speechMessage}{interimTranscript ? ` ${interimTranscript}` : ''}</p>
        )}

        <div className="optional-context-actions">
          <button className="text-button" type="button" onClick={onBack}>Zurück</button>
          <button ref={continueButtonRef} className="button" type="button" onClick={onContinue}>
            {hasAdditionalInfo ? 'Weiter' : 'Ohne Zusatzinfo weiter'}
            <AppIcon name="arrow" />
          </button>
        </div>
      </section>
    </div>
  );
}
