export type IntegrationPlatform =
  | 'whatsapp'
  | 'facebook'
  | 'instagram'
  | 'x'
  | 'linkedin'
  | 'pinterest'
  | 'email';

export type IntegrationSharePayload = {
  text?: string;
  title?: string;
  url?: string;
  imageUrl?: string;
};

export type IntegrationOpenResult = 'opened' | 'blocked';

function encoded(value?: string) {
  return encodeURIComponent(value?.trim() || '');
}

function safePublicUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function openExternal(url: string): IntegrationOpenResult {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) {
    try { opened.opener = null; } catch { /* noopener already requested */ }
    return 'opened';
  }
  return 'blocked';
}

export function openIntegrationTarget(
  platform: IntegrationPlatform,
  payload: IntegrationSharePayload,
): IntegrationOpenResult {
  const text = payload.text?.trim() || '';
  const title = payload.title?.trim() || '';
  const publicUrl = safePublicUrl(payload.url);

  if (platform === 'whatsapp') {
    const parts = [text, publicUrl].filter(Boolean).join('\n\n');
    return openExternal(`https://wa.me/?text=${encoded(parts)}`);
  }

  if (platform === 'x') {
    const params = new URLSearchParams();
    if (text) params.set('text', text);
    if (publicUrl) params.set('url', publicUrl);
    return openExternal(`https://twitter.com/intent/tweet?${params.toString()}`);
  }

  if (platform === 'email') {
    const params = new URLSearchParams();
    if (title) params.set('subject', title);
    if (text || publicUrl) params.set('body', [text, publicUrl].filter(Boolean).join('\n\n'));
    window.location.href = `mailto:?${params.toString()}`;
    return 'opened';
  }

  if (platform === 'facebook') {
    if (!publicUrl) return openExternal('https://www.facebook.com/');
    return openExternal(`https://www.facebook.com/sharer/sharer.php?u=${encoded(publicUrl)}`);
  }

  if (platform === 'linkedin') {
    if (!publicUrl) return openExternal('https://www.linkedin.com/feed/');
    return openExternal(`https://www.linkedin.com/sharing/share-offsite/?url=${encoded(publicUrl)}`);
  }

  if (platform === 'pinterest') {
    const publicImage = safePublicUrl(payload.imageUrl);
    if (!publicUrl || !publicImage) return openExternal('https://www.pinterest.com/');
    const params = new URLSearchParams({
      url: publicUrl,
      media: publicImage,
      description: text,
    });
    return openExternal(`https://www.pinterest.com/pin/create/button/?${params.toString()}`);
  }

  return openExternal('https://www.instagram.com/');
}
