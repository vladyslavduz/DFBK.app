export const publishingChannels = [
  { id: 'instagram', label: 'Instagram', icon: 'instagram.svg', url: 'https://www.instagram.com/' },
  { id: 'facebook', label: 'Facebook', icon: 'facebook.svg', url: 'https://www.facebook.com/' },
  { id: 'pinterest', label: 'Pinterest', icon: 'pinterest.svg', url: 'https://www.pinterest.com/' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp.svg', url: 'https://web.whatsapp.com/' },
  { id: 'x', label: 'X', icon: 'x.svg', url: 'https://x.com/' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'linkedin.svg', url: 'https://www.linkedin.com/feed/' },
  { id: 'email', label: 'E-Mail', icon: 'email.svg', url: 'mailto:' },
  { id: 'google_business', label: 'Google Business', icon: 'google-business.svg', url: 'https://business.google.com/' },
  { id: 'website', label: 'Website / Blog', icon: 'website.svg', url: '' },
] as const;
export type PublishingChannel = typeof publishingChannels[number]['id'];
export const promoImage = '/visual/integrations/friseur-optimized.webp';
export const promoTexts: Record<PublishingChannel, string> = {
  instagram: 'Deine Arbeit verdient Sichtbarkeit. 📸 Foto aufnehmen, mit DFBK aufbereiten und deinen nächsten Beitrag vorbereiten. Du machst die Arbeit. DFBK macht sie sichtbar.\n\nhttps://dfbk.app\n#DFBK #Handwerk #Kleinunternehmen',
  facebook: 'Gute Arbeit zeigen – ohne lange am Werbetext zu sitzen. DFBK bereitet aus deinem Arbeitsfoto ein optimiertes Bild und Texte für deine Kanäle vor. Prüfe das Ergebnis und teile es dort, wo deine Kunden sind.\n\nDFBK ausprobieren: https://dfbk.app',
  pinterest: 'Aus dem Arbeitsfoto wird eine Projektidee zum Zeigen: DFBK bereitet Bild und Marketingtexte für deinen Betrieb vor.\n\nMehr erfahren: https://dfbk.app',
  whatsapp: 'Du machst die Arbeit. DFBK macht sie sichtbar. Aus deinem Arbeitsfoto werden ein optimiertes Bild und vorbereitete Marketingtexte.\nhttps://dfbk.app',
  x: 'Gute Arbeit verdient Sichtbarkeit. DFBK bereitet aus deinem Arbeitsfoto Bild und Marketingtexte vor. Foto aufnehmen, Ergebnis prüfen, weitergeben. https://dfbk.app',
  linkedin: 'Für kleine Betriebe bleibt nach der eigentlichen Arbeit oft wenig Zeit für Marketing. DFBK unterstützt dabei, reale Projektergebnisse mit aufbereiteten Fotos und vorbereiteten Texten sichtbar zu machen.\nhttps://dfbk.app',
  email: 'Entdecke DFBK.app: Aus Fotos deiner Arbeit werden aufbereitete Bilder und Marketingtexte. Du machst die Arbeit. DFBK macht sie sichtbar.\nhttps://dfbk.app',
  google_business: 'DFBK unterstützt kleine Betriebe dabei, ihre Arbeit mit aufbereiteten Fotos und vorbereiteten Marketingtexten zu präsentieren. Mehr erfahren: https://dfbk.app',
  website: 'DFBK.app – Dein Foto bringt Kunden.\nAus Fotos realer Arbeiten bereitet DFBK optimierte Bilder und Marketingtexte vor. Die Ergebnisse können geprüft und für die eigenen Kanäle verwendet werden.\nhttps://dfbk.app',
};
export const promoVideos = [
  { url: '/promo/dfbk-promo-vertical.mp4', label: 'Hochformat', width: 1080, height: 1920 },
  { url: '/promo/dfbk-promo-square.mp4', label: 'Quadratisch', width: 1080, height: 1080 },
];
