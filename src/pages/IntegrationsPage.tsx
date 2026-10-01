import type { CSSProperties } from 'react';
import PageShell from '../components/PageShell';
import IntegrationDemo from '../components/IntegrationDemo';
import '../styles/integrations-share.css';

const localIcons = '/visual/integrations/icons';

type Brand = {
  name: string;
  src?: string;
  path?: string;
  color?: string;
};

const social: Brand[] = [
  { name: 'Instagram', src: `${localIcons}/instagram.svg` },
  { name: 'Facebook', src: `${localIcons}/facebook.svg` },
  { name: 'TikTok', color: '#000000', path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z' },
  { name: 'LinkedIn', src: `${localIcons}/linkedin.svg` },
  { name: 'Pinterest', src: `${localIcons}/pinterest.svg` },
  { name: 'X', src: `${localIcons}/x.svg` }
];

const messengers: Brand[] = [
  { name: 'WhatsApp', src: `${localIcons}/whatsapp.svg` },
  { name: 'Messenger', color: '#0084FF', path: 'M12 0C5.24 0 0 4.952 0 11.64c0 3.499 1.434 6.521 3.769 8.61a.96.96 0 0 1 .323.683l.065 2.135a.96.96 0 0 0 1.347.85l2.381-1.053a.96.96 0 0 1 .641-.046A13 13 0 0 0 12 23.28c6.76 0 12-4.952 12-11.64S18.76 0 12 0m6.806 7.44c.522-.03.971.567.63 1.094l-4.178 6.457a.707.707 0 0 1-.977.208l-3.87-2.504a.44.44 0 0 0-.49.007l-4.363 3.01c-.637.438-1.415-.317-.995-.966l4.179-6.457a.706.706 0 0 1 .977-.21l3.87 2.505c.15.097.344.094.491-.007l4.362-3.008a.7.7 0 0 1 .364-.13' },
  { name: 'Telegram', src: `${localIcons}/telegram.svg` },
  { name: 'Signal', color: '#3A76F0', path: 'M12 0q-.934 0-1.83.139l.17 1.111a11 11 0 0 1 3.32 0l.172-1.111A12 12 0 0 0 12 0M12 2.25a9.75 9.75 0 0 0-8.539 14.459c.074.134.1.292.064.441l-1.013 4.338 4.338-1.013a.62.62 0 0 1 .441.064A9.7 9.7 0 0 0 12 21.75c5.385 0 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25' }
];

const websites: Brand[] = [
  { name: 'WordPress', color: '#21759B', path: 'M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0' },
  { name: 'Wix', color: '#0C0C0C', path: 'm0 7.354 2.113 9.292h.801a1.54 1.54 0 0 0 1.506-1.218l1.351-6.34a.171.171 0 0 1 .167-.137c.08 0 .15.058.167.137l1.352 6.34a1.54 1.54 0 0 0 1.506 1.218h.805l2.113-9.292h-.565c-.62 0-1.159.43-1.296 1.035l-1.26 5.545-1.106-5.176a1.76 1.76 0 0 0-2.19-1.324c-.639.176-1.113.716-1.251 1.365l-1.094 5.127-1.26-5.537A1.33 1.33 0 0 0 .563 7.354H0zm13.992 0a.951.951 0 0 0-.951.95v8.342h.635a.952.952 0 0 0 .951-.95V7.353h-.635zm1.778 0 3.158 4.66-3.14 4.632h1.325c.368 0 .712-.181.918-.486l1.756-2.59a.12.12 0 0 1 .197 0l1.754 2.59c.206.305.55.486.918.486h1.326l-3.14-4.632L24 7.354h-1.326c-.368 0-.712.181-.918.486l-1.772 2.617a.12.12 0 0 1-.197 0L18.014 7.84a1.108 1.108 0 0 0-.918-.486H15.77z' },
  { name: 'Joomla', color: '#5091CD', path: 'M16.719 14.759L14.22 17.26l-2.37 2.37-.462.466c-1.368 1.365-3.297 1.83-5.047 1.397-.327 1.424-1.604 2.49-3.13 2.49C1.438 23.983 0 22.547 0 20.772c0-1.518 1.055-2.789 2.469-3.123-.446-1.76.016-3.705 1.396-5.08l.179-.18 2.37 2.37-.184.181c-.769.779-.769 2.024 0 2.789.771.78 2.022.78 2.787 0l.465-.465 2.367-2.371 2.502-2.506 2.368 2.372zm.924 6.652c-1.822.563-3.885.12-5.328-1.318l-.18-.185 2.365-2.369.18.184c.771.768 2.018.768 2.787 0 .765-.765.769-2.01-.004-2.781l-.466-.465-2.365-2.37-2.502-2.503 2.37-2.369 2.499 2.505 2.367 2.37.464.464c1.365 1.36 1.846 3.278 1.411 5.021 1.56.224 2.759 1.56 2.759 3.18 0 1.784-1.439 3.21-3.209 3.21-1.545 0-2.851-1.096-3.135-2.565l-.013-.009zM6.975 9.461l2.508-2.505 2.37-2.369.462-.461C13.74 2.7 15.772 2.251 17.58 2.79c.212-1.561 1.555-2.775 3.179-2.775 1.772 0 3.211 1.437 3.211 3.209 0 1.631-1.216 2.978-2.79 3.186.519 1.799.068 3.816-1.35 5.234l-.182.184-2.369-2.369.184-.184c.769-.77.769-2.016 0-2.783-.766-.766-2.011-.768-2.781.003l-.462.461-2.37 2.369-2.505 2.502-2.37-2.366z' },
  { name: 'Webflow', color: '#146EF5', path: 'm24 4.515-7.658 14.97H9.149l3.205-6.204h-.144C9.566 16.713 5.621 18.973 0 19.485v-6.118s3.596-.213 5.71-2.435H0V4.515h6.417v5.278l.144-.001 2.622-5.277h4.854v5.244h.144l2.72-5.244H24Z' },
  { name: 'Squarespace', color: '#000000', path: 'M22.655 8.719c-1.802-1.801-4.726-1.801-6.564 0l-7.351 7.35c-.45.45-.45 1.2 0 1.65.45.449 1.2.449 1.65 0l7.351-7.351c.899-.899 2.362-.899 3.264 0 .9.9.9 2.364 0 3.264l-7.239 7.239c.9.899 2.362.899 3.263 0l5.589-5.589c1.836-1.838 1.836-4.763.037-6.563zm-2.475 2.437c-.451-.45-1.201-.45-1.65 0l-7.354 7.389c-.9.899-2.361.899-3.262 0-.45-.45-1.2-.45-1.65 0s-.45 1.2 0 1.649c1.801 1.801 4.726 1.801 6.564 0l7.351-7.35c.449-.487.449-1.239.001-1.688z' }
];

function BrandRow({ items }: { items: Brand[] }) {
  return (
    <div className="share-brand-row">
      {items.map((brand) => {
        const style = brand.color ? ({ '--brand-color': brand.color } as CSSProperties) : undefined;
        return (
          <button
            className={`share-brand${brand.path ? ' share-brand--embedded' : ''}`}
            type="button"
            key={brand.name}
            aria-label={brand.name}
            title={brand.name}
            style={style}
          >
            {brand.src ? <img src={brand.src} alt="" /> : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={brand.path} /></svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <PageShell
      eyebrow="Integrationen"
      title="Kanäle verbinden"
      intro="Aus einem Foto wird professioneller Content für Website, Google Business und Social Media."
    >
      <IntegrationDemo />

      <section className="share-hub" aria-label="DFBK teilen">
        <div className="share-hub__intro">
          <span className="share-hub__eyebrow">DFBK teilen</span>
          <h2>Zeig, was DFBK aus einem Foto machen kann.</h2>
          <p>Wähle einen Kanal. Später wird hier das fertige Promo-Video zusammen mit einem passenden Werbetext geteilt.</p>
        </div>

        <div className="share-hub__package">
          <div className="share-hub__preview" aria-hidden="true">
            <img className="share-hub__preview-bg" src="/visual/integrations/friseur-optimized.webp" alt="" />
            <img className="share-hub__preview-main" src="/visual/integrations/friseur-optimized.webp" alt="" />
          </div>

          <div className="share-hub__message">
            <h3>Vorschau des Werbetextes</h3>
            <p>
              <strong>Du machst die Arbeit. DFBK macht sie sichtbar.</strong><br /><br />
              Aus einem Foto deiner Arbeit erstellt DFBK optimierten Content für Website, Google und Social Media – schnell, einfach und ohne Marketing-Stress.<br /><br />
              <strong>Dein Foto bringt Kunden.</strong>
            </p>
            <span className="share-hub__url">dfbk.app</span>
          </div>
        </div>

        <div className="share-zone share-zone--compact">
          <h3>Teilen · Soziale Netzwerke</h3>
          <BrandRow items={social} />
        </div>

        <div className="share-zone share-zone--compact">
          <h3>Teilen · Messenger</h3>
          <BrandRow items={messengers} />
        </div>

        <div className="share-zone share-zone--compact">
          <h3>Teilen · Website &amp; CMS</h3>
          <BrandRow items={websites} />
        </div>

        <p className="share-hub__note">
          <strong>Prototyp:</strong> Die Symbole sind noch ohne Funktion. Im nächsten Schritt verbinden wir jeden Kanal mit dem passenden Share-, API- oder Embed-Workflow.
        </p>
      </section>
    </PageShell>
  );
}
