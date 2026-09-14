import AppLink from './AppLink';

export default function Header() {
  return (
    <header className="site-header container">
      <AppLink className="brand" to="/">DFBK</AppLink>
      <nav>
        <a href="/#features">Funktionen</a>
        <a href="/#how">So funktioniert's</a>
        <a href="/#pricing">Preise</a>
      </nav>
      <AppLink className="button button-small" to="/create">Kostenlos testen</AppLink>
    </header>
  );
}
