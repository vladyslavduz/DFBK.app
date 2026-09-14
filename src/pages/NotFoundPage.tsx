import PageShell from '../components/PageShell';
import AppLink from '../components/AppLink';

export default function NotFoundPage() {
  return <PageShell eyebrow="404" title="Seite nicht gefunden" intro="Diese Route existiert noch nicht."><AppLink className="button" to="/">Zur Startseite</AppLink></PageShell>;
}
