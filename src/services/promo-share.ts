import { promoTexts, type PublishingChannel } from '../config/publishing';

export const promoShareUrl = 'https://dfbk.app/share/friseur.html';
export const promoShareImage = 'https://dfbk.app/promo/dfbk-friseur.jpg';
export const promoShareTitle = 'DFBK.app – Aus dem Friseurfoto wird Werbung';

export function promoShareText(channel: PublishingChannel) {
  return promoTexts[channel].replaceAll('https://dfbk.app', promoShareUrl);
}

// These URLs open a service's user-confirmed composer; they never publish by themselves.
export function promoShareLink(channel: PublishingChannel): string | null {
  if (!Object.hasOwn(promoTexts, channel)) return null;
  const url = encodeURIComponent(promoShareUrl);
  const text = encodeURIComponent(promoShareText(channel));
  switch (channel) {
    case 'facebook': return 'https://www.facebook.com/sharer/sharer.php?u=' + url;
    case 'whatsapp': return 'https://wa.me/?text=' + text;
    case 'x': return 'https://twitter.com/intent/tweet?text=' + text;
    case 'linkedin': return 'https://www.linkedin.com/sharing/share-offsite/?url=' + url;
    case 'pinterest': return 'https://www.pinterest.com/pin/create/button/?url=' + url + '&media=' + encodeURIComponent(promoShareImage) + '&description=' + text;
    case 'email': return 'mailto:?subject=' + encodeURIComponent(promoShareTitle) + '&body=' + text;
    default: return null;
  }
}

export const promoEmbedHtml = '<article>\n  <img src="' + promoShareImage + '" alt="DFBK-Beispiel: optimiertes Friseurfoto" style="max-width:100%;height:auto">\n  <h2>Dein Foto bringt Kunden.</h2>\n  <p>Beispiel Friseursalon: DFBK bereitet aus einem Arbeitsfoto ein optimiertes Bild und Marketingtexte vor.</p>\n  <p><a href="' + promoShareUrl + '" rel="noopener">DFBK.app entdecken</a></p>\n</article>';
export const cmsPlatforms = ['WordPress', 'Wix', 'Joomla', 'Drupal', 'Tilda', 'Jimdo', 'IONOS', 'Webflow', 'Squarespace', 'Ghost', 'Blogger', 'Shopify', 'TYPO3', 'Andere Website'] as const;
