import PageShell from '../components/PageShell';

const CONTACT_EMAIL = 'dfbk.app@gmail.com';

function ContactAddress() {
  return (
    <address>
      Vladyslav Duz<br />
      Kirchstraße 45<br />
      77855 Achern<br />
      Deutschland<br />
      E-Mail: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    </address>
  );
}

function Impressum() {
  return (
    <PageShell eyebrow="Rechtliches" title="Impressum" intro="Anbieterkennzeichnung und Kontaktinformationen zu DFBK.app.">
      <article className="legal-copy">
        <section>
          <h2>Angaben gemäß § 5 DDG</h2>
          <p>DFBK.app ist ein derzeit in Entwicklung befindliches Softwareprojekt.</p>
          <ContactAddress />
        </section>
        <section>
          <h2>Verantwortlich für den Inhalt</h2>
          <ContactAddress />
        </section>
        <section>
          <h2>Verbraucherstreitbeilegung</h2>
          <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
        </section>
        <section>
          <h2>Hinweis zum Projektstatus</h2>
          <p>DFBK.app befindet sich im Aufbau. Funktionsumfang, Verfügbarkeit und rechtliche Informationen werden vor dem kommerziellen Start an das endgültige Angebot angepasst.</p>
        </section>
        <p className="legal-updated">Stand: 19. September 2026</p>
      </article>
    </PageShell>
  );
}

function Datenschutz() {
  return (
    <PageShell eyebrow="Datenschutz" title="Datenschutzerklärung" intro="Hier erfährst du, welche personenbezogenen Daten DFBK.app verarbeitet und wofür sie verwendet werden.">
      <article className="legal-copy">
        <section>
          <h2>1. Verantwortlicher</h2>
          <p>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</p>
          <ContactAddress />
        </section>

        <section>
          <h2>2. Aufruf der Website und Hosting</h2>
          <p>Beim Aufruf von dfbk.app werden technisch erforderliche Verbindungsdaten verarbeitet. Dazu können insbesondere IP-Adresse, Datum und Uhrzeit des Abrufs, aufgerufene URL, Referrer-URL, Browser- und Geräteinformationen sowie technische Status- und Sicherheitsdaten gehören.</p>
          <p>Die Website wird über die Infrastruktur von Cloudflare bereitgestellt. Cloudflare unterstützt die Auslieferung, Sicherheit und Stabilität der Website. Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse liegt im sicheren und zuverlässigen Betrieb des Angebots.</p>
          <p>Weitere Informationen findest du in der <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Datenschutzerklärung von Cloudflare</a>.</p>
        </section>

        <section>
          <h2>3. Registrierung mit E-Mail und Passwort</h2>
          <p>Bei einer Registrierung verarbeiten wir die von dir eingegebenen Daten, insbesondere Name, E-Mail-Adresse und ein technisch gesichertes Passwort-Hash. Die Verarbeitung dient der Erstellung und Verwaltung deines DFBK.app-Kontos sowie der Anmeldung und erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO.</p>
          <p>Nutzer- und Sitzungsdaten werden in einer Cloudflare-D1-Datenbank gespeichert. Passwörter werden nicht im Klartext gespeichert.</p>
        </section>

        <section>
          <h2>4. Anmeldung mit Google OAuth</h2>
          <p>Wenn du „Mit Google“ auswählst, verwenden wir Google OAuth beziehungsweise OpenID Connect zur Registrierung und Anmeldung. Dabei wirst du zu Google weitergeleitet und authentifizierst dich dort. DFBK.app erhält ausschließlich die für den Kontozugang erforderlichen, von dir freigegebenen Daten.</p>
          <p>Geplant sind ausschließlich die minimalen Berechtigungen:</p>
          <ul>
            <li><code>openid</code> – eindeutige Zuordnung des Google-Kontos,</li>
            <li><code>email</code> – Übermittlung der E-Mail-Adresse,</li>
            <li><code>profile</code> – Name und, sofern vorhanden, Profilbild.</li>
          </ul>
          <p>Verarbeitet werden können der eindeutige Google-Konto-Identifier, Name, E-Mail-Adresse und ein vorhandenes Profilbild beziehungsweise dessen URL. Zweck ist ausschließlich die Registrierung, Anmeldung und Verwaltung des DFBK.app-Kontos. Die zugehörigen Kontodaten und die DFBK.app-Sitzung werden in Cloudflare D1 gespeichert. Wir greifen dabei nicht auf Google Drive, Kontakte, Kalender, Gmail oder andere Google-Inhalte zu.</p>
          <p>Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Für die Verarbeitung durch Google gelten ergänzend die <a href="https://policies.google.com/privacy?hl=de" target="_blank" rel="noreferrer">Datenschutzbestimmungen von Google</a>. Google kann Daten auch außerhalb des Europäischen Wirtschaftsraums verarbeiten.</p>
          <div className="legal-note">Google-Nutzerdaten werden nicht verkauft, nicht für Werbung verwendet und nicht an Datenhändler weitergegeben. Die Nutzung ist auf die ausdrücklich beschriebene Kontofunktion begrenzt.</div>
        </section>

        <section>
          <h2>5. Session-Cookie</h2>
          <p>Nach erfolgreicher Anmeldung setzt DFBK.app das technisch notwendige Cookie <code>dfbk_session</code>. Es ermöglicht, dass du während deiner Sitzung angemeldet bleibst. Das Cookie wird mit den Schutzmerkmalen <code>HttpOnly</code>, <code>Secure</code> und <code>SameSite=Lax</code> gesetzt und ist für bis zu 30 Tage vorgesehen.</p>
          <p>Rechtsgrundlage ist § 25 Abs. 2 Nr. 2 TDDDG sowie Art. 6 Abs. 1 lit. b DSGVO. Für dieses notwendige Cookie ist keine Einwilligung erforderlich. Derzeit setzt DFBK.app keine Analyse- oder Marketing-Cookies ein.</p>
        </section>

        <section>
          <h2>6. Service-E-Mails über Resend</h2>
          <p>Für technisch erforderliche Nachrichten, etwa zur Bestätigung einer E-Mail-Adresse, verwenden wir Resend. Dabei werden insbesondere Empfängeradresse, Nachrichteninhalt und technische Versanddaten verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.</p>
          <p>Weitere Informationen findest du in der <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer">Datenschutzerklärung von Resend</a>. Resend kann Daten in den USA verarbeiten.</p>
        </section>

        <section>
          <h2>7. Kontaktaufnahme</h2>
          <p>Wenn du uns per E-Mail kontaktierst, verarbeiten wir deine E-Mail-Adresse, den Inhalt deiner Nachricht und weitere freiwillig übermittelte Angaben, um dein Anliegen zu beantworten. Rechtsgrundlage ist je nach Inhalt Art. 6 Abs. 1 lit. b oder lit. f DSGVO.</p>
        </section>

        <section>
          <h2>8. Empfänger und Übermittlungen in Drittländer</h2>
          <p>Daten erhalten nur die für den Betrieb erforderlichen Dienstleister, insbesondere Cloudflare, Google bei Nutzung der Google-Anmeldung und Resend beim Versand von Service-E-Mails. Soweit Daten außerhalb des Europäischen Wirtschaftsraums verarbeitet werden, stützen die Anbieter die Übermittlung nach eigenen Angaben insbesondere auf Angemessenheitsbeschlüsse, das EU-US Data Privacy Framework oder EU-Standardvertragsklauseln.</p>
        </section>

        <section>
          <h2>9. Speicherdauer</h2>
          <p>Wir speichern personenbezogene Daten nur so lange, wie sie für den jeweiligen Zweck erforderlich sind oder gesetzliche Aufbewahrungspflichten bestehen. Kontodaten werden grundsätzlich bis zur Löschung des Kontos gespeichert. Sitzungen laufen regulär nach spätestens 30 Tagen ab und können beim Abmelden beendet werden. Service- und Sicherheitsprotokolle werden nur so lange aufbewahrt, wie dies für Betrieb, Sicherheit und Fehleranalyse erforderlich ist.</p>
        </section>

        <section>
          <h2>10. Deine Rechte</h2>
          <p>Nach Maßgabe der gesetzlichen Voraussetzungen hast du insbesondere das Recht auf:</p>
          <ul>
            <li>Auskunft über deine gespeicherten personenbezogenen Daten,</li>
            <li>Berichtigung unrichtiger Daten,</li>
            <li>Löschung oder Einschränkung der Verarbeitung,</li>
            <li>Datenübertragbarkeit,</li>
            <li>Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen,</li>
            <li>Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft.</li>
          </ul>
          <p>Zur Ausübung deiner Rechte genügt eine E-Mail an <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </section>

        <section>
          <h2>11. Beschwerderecht</h2>
          <p>Du hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren. Für den Sitz des Verantwortlichen ist insbesondere der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg zuständig: <a href="https://www.baden-wuerttemberg.datenschutz.de/" target="_blank" rel="noreferrer">www.baden-wuerttemberg.datenschutz.de</a>.</p>
        </section>

        <section>
          <h2>12. Sicherheit und Aktualisierung</h2>
          <p>Wir setzen angemessene technische und organisatorische Maßnahmen ein, um personenbezogene Daten zu schützen. Diese Datenschutzerklärung wird angepasst, wenn sich Funktionen, Dienstleister oder gesetzliche Anforderungen ändern. Zusätzliche Datenverarbeitungen werden erst nach entsprechender Aktualisierung dieser Informationen produktiv eingesetzt.</p>
        </section>

        <p className="legal-updated">Stand: 19. September 2026</p>
      </article>
    </PageShell>
  );
}

function Nutzungsbedingungen() {
  return (
    <PageShell eyebrow="Rechtliches" title="Nutzungsbedingungen" intro="Regeln für die Nutzung von DFBK.app während der Entwicklungs- und Testphase.">
      <article className="legal-copy">
        <div className="legal-note">DFBK.app befindet sich in der Entwicklungs- und Testphase. Derzeit werden über die Website keine kostenpflichtigen Verträge abgeschlossen.</div>
        <section>
          <h2>1. Geltungsbereich und Anbieter</h2>
          <p>Diese Nutzungsbedingungen gelten für die Nutzung von DFBK.app. Anbieter ist Vladyslav Duz, Kirchstraße 45, 77855 Achern, Deutschland, E-Mail: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </section>
        <section>
          <h2>2. Zweck des Dienstes</h2>
          <p>DFBK.app soll Nutzer dabei unterstützen, Fotos und Angaben zu ihrer Arbeit zu strukturieren und daraus Inhalte für Website, Google Business und soziale Medien vorzubereiten. Einzelne Funktionen können während der Testphase eingeschränkt, vorläufig oder noch nicht verfügbar sein.</p>
        </section>
        <section>
          <h2>3. Registrierung und Konto</h2>
          <p>Für bestimmte Funktionen ist ein Konto erforderlich. Angaben müssen vollständig und richtig sein. Zugangsdaten sind vertraulich zu behandeln. Nutzer informieren uns unverzüglich, wenn sie eine unbefugte Nutzung ihres Kontos vermuten.</p>
        </section>
        <section>
          <h2>4. Zulässige Nutzung</h2>
          <p>Nutzer dürfen DFBK.app nicht für rechtswidrige oder missbräuchliche Zwecke verwenden.</p>
          <ul>
            <li>Es dürfen nur Inhalte hochgeladen werden, für die die erforderlichen Rechte bestehen.</li>
            <li>Rechte Dritter, insbesondere Urheber-, Marken- und Persönlichkeitsrechte, sind zu beachten.</li>
            <li>Schädlicher Code, automatisierte Angriffe und Manipulationsversuche sind untersagt.</li>
            <li>Rechtswidrige, beleidigende oder täuschende Inhalte dürfen nicht verarbeitet werden.</li>
          </ul>
        </section>
        <section>
          <h2>5. Verantwortung für Inhalte</h2>
          <p>Nutzer bleiben für hochgeladene, bearbeitete und veröffentlichte Inhalte verantwortlich. Automatisch erstellte Vorschläge können Fehler enthalten und müssen vor einer Veröffentlichung auf Richtigkeit, Rechte Dritter und Eignung geprüft werden.</p>
        </section>
        <section>
          <h2>6. Verfügbarkeit und Änderungen</h2>
          <p>Während der Entwicklungsphase besteht kein Anspruch auf eine bestimmte Verfügbarkeit oder einen unveränderten Funktionsumfang. Funktionen können zu Test-, Wartungs-, Sicherheits- oder Entwicklungszwecken geändert, eingeschränkt oder vorübergehend deaktiviert werden.</p>
        </section>
        <section>
          <h2>7. Nutzungsrechte</h2>
          <p>Nutzer behalten ihre Rechte an eigenen Inhalten. Sie räumen DFBK.app nur die technisch erforderlichen Rechte ein, um die jeweils ausgewählte Funktion auszuführen. Rechte an Marke, Gestaltung, Software und eigenen Inhalten von DFBK.app verbleiben beim Anbieter beziehungsweise den jeweiligen Rechteinhabern.</p>
        </section>
        <section>
          <h2>8. Haftung</h2>
          <p>Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei schuldhafter Verletzung von Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vorhersehbaren, typischerweise eintretenden Schaden begrenzt. Zwingende gesetzliche Haftung bleibt unberührt.</p>
        </section>
        <section>
          <h2>9. Datenschutz</h2>
          <p>Informationen zur Verarbeitung personenbezogener Daten enthält unsere <a href="/datenschutz">Datenschutzerklärung</a>.</p>
        </section>
        <section>
          <h2>10. Schlussbestimmungen</h2>
          <p>Es gilt deutsches Recht. Zwingende Verbraucherschutzvorschriften des Staates, in dem ein Verbraucher seinen gewöhnlichen Aufenthalt hat, bleiben unberührt. Vor einem kostenpflichtigen Start werden diese Bedingungen an das endgültige Geschäftsmodell angepasst.</p>
        </section>
        <p className="legal-updated">Stand: 19. September 2026</p>
      </article>
    </PageShell>
  );
}

const placeholders = {
  agb: ['Allgemeine Geschäftsbedingungen', '[ AGB vor kommerziellem Start rechtlich prüfen und hier einsetzen. ]'],
  widerruf: ['Widerrufsbelehrung', '[ Für das konkrete B2B/B2C-Modell rechtlich prüfen und hier einsetzen. ]'],
} as const;

type LegalType = 'impressum' | 'datenschutz' | 'nutzungsbedingungen' | keyof typeof placeholders;

export default function LegalPage({ type }: { type: LegalType }) {
  if (type === 'impressum') return <Impressum />;
  if (type === 'datenschutz') return <Datenschutz />;
  if (type === 'nutzungsbedingungen') return <Nutzungsbedingungen />;
  const [title, text] = placeholders[type];
  return <PageShell eyebrow="Rechtliches" title={title}><div className="legal-copy"><p>{text}</p></div></PageShell>;
}
