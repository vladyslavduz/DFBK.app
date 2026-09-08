const steps = [
  ['Fotos hochladen', 'Fotos direkt auf der Baustelle oder nach Abschluss auswählen.'],
  ['AI analysiert', 'DFBK erkennt Arbeit, Kontext und relevante Details.'],
  ['Content erstellen', 'Automatisch passende Texte und Formate erzeugen.'],
  ['Prüfen & verwenden', 'Inhalt prüfen, kopieren, herunterladen oder später direkt veröffentlichen.']
];

export default function HowItWorks() {
  return <section id="how" className="section section-muted"><div className="container"><span className="eyebrow">Ablauf</span><h2>So funktioniert DFBK</h2><div className="steps">{steps.map(([t,d],i)=><article className="step" key={t}><span>{i+1}</span><div><h3>{t}</h3><p>{d}</p></div></article>)}</div></div></section>;
}
