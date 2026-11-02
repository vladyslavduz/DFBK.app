import type { PublishingChannel } from '../config/publishing';

// Only the user's text is passed out. Never send authenticated media URLs,
// private project routes or the public DFBK promotional example.
export function projectChannelLink(channel: PublishingChannel, title: string, text: string): string | null {
  switch (channel) {
    case 'whatsapp': return 'https://wa.me/?text=' + encodeURIComponent(text);
    case 'x': return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
    case 'email': return 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(text);
    default: return null;
  }
}
