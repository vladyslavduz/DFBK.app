export type IntegrationStatus = 'placeholder' | 'api-ready' | 'planned';

export type IntegrationProvider = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  status: IntegrationStatus;
  category: 'local' | 'social' | 'website';
  capability: string;
};

export const integrationStatusLabels: Record<IntegrationStatus, string> = {
  placeholder: 'In Vorbereitung',
  'api-ready': 'API vorbereitet',
  planned: 'Geplant',
};

export const primaryIntegrations: IntegrationProvider[] = [
  {
    id: 'google-business-profile',
    name: 'Google Business Profile',
    shortName: 'G',
    description: 'Projekt-Updates später direkt für dein Unternehmensprofil vorbereiten und veröffentlichen.',
    status: 'placeholder',
    category: 'local',
    capability: 'Lokale Sichtbarkeit',
  },
  {
    id: 'meta',
    name: 'Instagram & Facebook',
    shortName: 'M',
    description: 'Beiträge aus einem DFBK.app Projekt für deine Social-Media-Kanäle bereitstellen.',
    status: 'api-ready',
    category: 'social',
    capability: 'Social Media',
  },
];

export const websiteIntegrations: IntegrationProvider[] = [
  { id: 'wordpress', name: 'WordPress', shortName: 'W', description: 'Beiträge und Referenzen an WordPress übergeben.', status: 'api-ready', category: 'website', capability: 'Website / Blog' },
  { id: 'wix', name: 'Wix', shortName: 'Wi', description: 'Projektinhalte für Wix Websites vorbereiten.', status: 'api-ready', category: 'website', capability: 'Website Builder' },
  { id: 'webflow', name: 'Webflow', shortName: 'Wf', description: 'Inhalte später in Webflow CMS Collections übertragen.', status: 'api-ready', category: 'website', capability: 'CMS' },
  { id: 'squarespace', name: 'Squarespace', shortName: 'Sq', description: 'Referenzen und Inhalte für Squarespace bereitstellen.', status: 'api-ready', category: 'website', capability: 'Website Builder' },
  { id: 'shopify', name: 'Shopify', shortName: 'S', description: 'Content für Shops, Projekte und redaktionelle Bereiche vorbereiten.', status: 'api-ready', category: 'website', capability: 'Commerce' },
  { id: 'shopware', name: 'Shopware', shortName: 'Sw', description: 'Inhalte für Shopware-basierte Unternehmensseiten vorbereiten.', status: 'api-ready', category: 'website', capability: 'Commerce' },
  { id: 'typo3', name: 'TYPO3', shortName: 'T3', description: 'Projekt- und Referenzinhalte strukturiert an TYPO3 anbinden.', status: 'api-ready', category: 'website', capability: 'CMS' },
  { id: 'joomla', name: 'Joomla!', shortName: 'J!', description: 'Inhalte für Joomla Websites und Beiträge vorbereiten.', status: 'api-ready', category: 'website', capability: 'CMS' },
  { id: 'drupal', name: 'Drupal', shortName: 'D', description: 'Strukturierte Inhalte für Drupal Content Types vorbereiten.', status: 'api-ready', category: 'website', capability: 'CMS' },
  { id: 'jimdo', name: 'Jimdo', shortName: 'J', description: 'DFBK.app Inhalte für kleine Jimdo Unternehmensseiten vorbereiten.', status: 'planned', category: 'website', capability: 'Website Builder' },
  { id: 'ghost', name: 'Ghost', shortName: 'Gh', description: 'Beiträge und Referenzen für Ghost-basierte Seiten vorbereiten.', status: 'api-ready', category: 'website', capability: 'Publishing' },
  { id: 'custom-api', name: 'Eigene Website / API', shortName: '{}', description: 'Offener Anschluss für individuelle Websites und eigene Systeme.', status: 'api-ready', category: 'website', capability: 'REST / Webhook' },
];

export const integrationPrinciples = [
  'Verbindung nur nach ausdrücklicher Freigabe',
  'Zugangsdaten niemals im Browser speichern',
  'Vor Veröffentlichung Inhalte prüfen können',
  'Automatische Veröffentlichung später optional aktivierbar',
] as const;
