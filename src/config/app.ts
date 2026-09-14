export const appConfig = {
  name: 'DFBK',
  fullName: 'DFBK.app',
  slogan: 'Dein Foto bringt Kunden.',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  features: {
    directPublishing: import.meta.env.VITE_FEATURE_DIRECT_PUBLISHING === '1',
    clientPortal: import.meta.env.VITE_FEATURE_CLIENT_PORTAL === '1',
    voice: import.meta.env.VITE_FEATURE_VOICE === '1',
    billing: import.meta.env.VITE_FEATURE_BILLING === '1'
  }
} as const;
