import { getProjectMediaUrl, projectService } from './projects';

export type ShareOutcome =
  | 'shared'
  | 'text-shared'
  | 'cancelled'
  | 'unsupported';

type ShareInput = {
  projectId: string;
  title?: string;
  text: string;
};

const preparedFiles = new Map<string, File | null>();
const preparingFiles = new Map<string, Promise<File | null>>();

function extensionForMime(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function fetchProjectShareFile(projectId: string): Promise<File | null> {
  const state = await projectService.getProjectMedia(projectId);
  const media = state.media.optimized || state.media.original;

  if (!media) return null;

  const response = await fetch(getProjectMediaUrl(projectId, media.id), {
    credentials: 'same-origin',
  });

  if (!response.ok) throw new Error('SHARE_IMAGE_FETCH_FAILED');

  const blob = await response.blob();
  const mimeType = blob.type || media.mimeType || 'image/jpeg';
  return new File(
    [blob],
    `dfbk-projektbild.${extensionForMime(mimeType)}`,
    { type: mimeType },
  );
}

export function invalidateProjectShareImage(projectId: string) {
  preparedFiles.delete(projectId);
  preparingFiles.delete(projectId);
}

export function prepareProjectShareImage(projectId: string): Promise<File | null> {
  if (preparedFiles.has(projectId)) {
    return Promise.resolve(preparedFiles.get(projectId) ?? null);
  }

  const existing = preparingFiles.get(projectId);
  if (existing) return existing;

  const request = fetchProjectShareFile(projectId)
    .catch(() => null)
    .then(file => {
      preparedFiles.set(projectId, file);
      preparingFiles.delete(projectId);
      return file;
    });

  preparingFiles.set(projectId, request);
  return request;
}

export async function shareProjectContent({ projectId, title, text }: ShareInput): Promise<ShareOutcome> {
  if (typeof navigator.share !== 'function') return 'unsupported';

  const file = preparedFiles.get(projectId) ?? null;
  const shareData: ShareData = {
    title: title?.trim() || undefined,
    text,
  };

  if (
    file &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    shareData.files = [file];
  }

  try {
    await navigator.share(shareData);
    return shareData.files?.length ? 'shared' : 'text-shared';
  } catch (error) {
    if (isAbortError(error)) return 'cancelled';

    if (shareData.files?.length) {
      try {
        await navigator.share({
          title: shareData.title,
          text: shareData.text,
        });
        return 'text-shared';
      } catch (fallbackError) {
        if (isAbortError(fallbackError)) return 'cancelled';
      }
    }

    return 'unsupported';
  }
}

export async function shareTextContent(title: string, text: string): Promise<ShareOutcome> {
  if (typeof navigator.share !== 'function') return 'unsupported';

  try {
    await navigator.share({ title, text });
    return 'text-shared';
  } catch (error) {
    return isAbortError(error) ? 'cancelled' : 'unsupported';
  }
}
