const items = [
  ['Foto aufnehmen', 'Hier kurze Beschreibung Vorteil 1.'],
  ['AI erstellt Content', 'Hier kurze Beschreibung Vorteil 2.'],
  ['Mit wenigen Klicks nutzen', 'Hier kurze Beschreibung Vorteil 3.']
];

export default function Benefits() {
  return <section className="section section-muted"><div className="container cards three">{items.map(([t,d]) => <article className="card" key={t}><h3>{t}</h3><p>{d}</p></article>)}</div></section>;
}
