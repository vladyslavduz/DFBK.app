import { ApiError } from './api';

const generationMessages: Record<string, string> = {
  PROJECT_DESCRIPTION_REQUIRED: 'Bitte füge eine Beschreibung hinzu.',
  PROJECT_IMAGE_REQUIRED: 'Bitte füge zuerst ein Foto hinzu.',
  GENERATION_ALREADY_RUNNING: 'Die Inhalte werden bereits erstellt. Bitte warte einen Moment.',
  AI_NOT_CONFIGURED: 'Die Inhaltserstellung ist derzeit nicht verfügbar. Bitte versuche es später erneut.',
  AI_GENERATION_FAILED: 'Die Inhalte konnten nicht erstellt werden. Bitte versuche es erneut.',
  AI_INVALID_RESPONSE: 'Die Inhalte konnten nicht verarbeitet werden. Bitte versuche es erneut.',
  PROJECT_IMAGE_UNAVAILABLE: 'Das Projektfoto ist derzeit nicht verfügbar. Bitte lade das Foto erneut hoch.',
  PROJECT_IMAGE_READ_FAILED: 'Das Projektfoto konnte nicht gelesen werden. Bitte versuche es erneut.',
  GENERATED_CONTENT_SAVE_FAILED: 'Die Inhalte konnten nicht gespeichert werden. Bitte versuche es erneut.',
  PROJECT_CONTENT_READ_FAILED: 'Die gespeicherten Inhalte konnten nicht geladen werden. Bitte versuche es erneut.',
  PROJECT_CONTENT_UNAVAILABLE: 'Die gespeicherten Inhalte sind noch nicht verfügbar. Bitte versuche es erneut.',
};

export function projectGenerationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return generationMessages[error.code] || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';
  }

  if (error instanceof TypeError) {
    return 'Keine Verbindung. Bitte prüfe deine Internetverbindung und versuche es erneut.';
  }

  return 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';
}
