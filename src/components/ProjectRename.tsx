import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ApiError } from '../lib/api';
import { useUserArea } from '../contexts/UserAreaContext';
import AppIcon from './AppIcon';

type Props = {
  projectId: string;
  title: string;
  onRenamed?: (title: string) => void;
  compact?: boolean;
};

function validateTitle(value: string) {
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (!normalized) return 'Bitte gib einen Projektnamen ein.';
  if (/[\p{Cc}\p{Cf}<>]/u.test(normalized)) return 'Der Projektname enthält nicht erlaubte Zeichen.';
  if (Array.from(normalized).length > 120) return 'Der Projektname darf maximal 120 Zeichen lang sein.';
  return '';
}

function renameError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_PROJECT_TITLE') return 'Bitte prüfe den Projektnamen.';
    if (error.code === 'PROJECT_NOT_FOUND') return 'Dieses Projekt ist nicht mehr verfügbar.';
    if (error.code === 'INVALID_ORIGIN') return 'Die Änderung wurde aus Sicherheitsgründen abgelehnt. Bitte lade die Seite neu.';
  }
  return 'Der Projektname konnte nicht gespeichert werden.';
}

export default function ProjectRename({ projectId, title, onRenamed, compact = false }: Props) {
  const { renameProject } = useUserArea();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setValue(title);
  }, [editing, title]);

  useEffect(() => {
    if (editing) requestAnimationFrame(() => inputRef.current?.focus());
  }, [editing]);

  function cancel() {
    if (saving) return;
    setEditing(false);
    setValue(title);
    setError('');
  }

  async function save() {
    if (saving) return;
    const validation = validateTitle(value);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await renameProject(projectId, value);
      setValue(updated.title);
      setEditing(false);
      onRenamed?.(updated.title);
    } catch (requestError) {
      setError(renameError(requestError));
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void save();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  }

  if (!editing) {
    return (
      <button className={`project-rename-trigger${compact ? ' is-compact' : ''}`} type="button" onClick={() => setEditing(true)} aria-label={`Projekt „${title}“ umbenennen`}>
        <AppIcon name="edit" />
      </button>
    );
  }

  return (
    <div className="project-rename-editor" onClick={event => event.stopPropagation()}>
      <input ref={inputRef} value={value} onChange={event => setValue(event.target.value)} onKeyDown={onKeyDown} disabled={saving} maxLength={240} aria-label="Projektname" />
      <div className="project-rename-actions">
        <button className="button button-secondary" type="button" onClick={cancel} disabled={saving}>Abbrechen</button>
        <button className="button" type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Speichert …' : 'Speichern'}</button>
      </div>
      {error && <small className="project-rename-error" role="alert">{error}</small>}
    </div>
  );
}
