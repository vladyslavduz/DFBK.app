const features = [
  'Branchenspezifische AI',
  'Foto- und Materialerkennung',
  'Automatische Textgenerierung',
  'Projekt-Archiv / Referenzen',
  'Google Business Content',
  'Social-Media-Ausgabe'
];

export default function Features() {
  return (
    <section id="features" className="section">
      <div className="container">
        <span className="eyebrow">Funktionen</span>
        <h2>Marketing-Werkzeuge für den Arbeitsalltag</h2>
        <div className="cards three">{features.map((x,i) => <article className="card" key={x}><div className="icon-placeholder">{i+1}</div><h3>{x}</h3><p>[ Beschreibung dieser Funktion ]</p></article>)}</div>
      </div>
    </section>
  );
}
