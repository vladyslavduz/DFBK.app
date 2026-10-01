# Plan & Gemacht — 01.10.2026

## DFBK-258 — Integrations / Promo-Demo

Status zum Tagesende: **UI/Animation weiterentwickelt, Share-Hub als Prototyp begonnen.**

### Heute umgesetzt

- `/integrations` Promo-Animation deutlich verfeinert.
- Bilddarstellung auf breiten Screens verbessert: schwarze Seitenflächen durch Blur-/Glass-Fill aus demselben Bild ersetzt; Hauptbild bleibt proportional und vollständig sichtbar.
- Zentraler Processing-Moment auf den quadratischen DFBK.app Brand-Mark/Favicon umgestellt und mit Neon-/Glow-Effekt versehen.
- Processing visuell erweitert: DFBK-Logo wird zeitweise transparent, darunter erscheint das unbearbeitete Foto nach der Friseur-Arbeit und geht in `friseur-optimized.webp` über.
- Logikfehler im Storytelling korrigiert: DFBK darf die Frisur nicht „erzeugen“.
  - Start: `friseur-before.webp` = **Original / vor der Friseur-Arbeit**.
  - Dazwischen: dezente Scheren-/Kamm-Animation als Symbol für die reale Arbeit des Friseurs.
  - Danach: `friseur-after.webp` = **Nach dem Schnitt**, noch nicht von DFBK optimiert.
  - Erst dieses Foto wird vom Smartphone fotografiert und anschließend von DFBK verarbeitet.
  - Ergebnis: `friseur-optimized.webp` = **DFBK.app optimiert**.
- Animationszyklus auf ca. 14 s erweitert, damit der zusätzliche reale Arbeitsschritt verständlich bleibt.
- Finale Vergleichsszene beibehalten: **Original** vs **DFBK.app optimiert**.

### Share-Hub unter der Animation

- Alten technischen Integrations-/API-Key-Block auf `/integrations` durch einen produktorientierten Share-Prototyp ersetzt.
- Drei Bereiche eingeführt:
  - **Teilen · Soziale Netzwerke**
  - **Teilen · Messenger**
  - **Teilen · Website & CMS**
- Promo-Paket-Vorschau mit Werbetext und `dfbk.app` ergänzt.
- Zielbild für die spätere Funktion festgelegt: Promo-Video + Werbetext + Link / UTM, je nach Zielplattform über Share-Link, Web Share, OAuth/API oder Embed-Workflow.
- Brand-Auswahl bewusst kompakt gehalten: nur Icons, keine sichtbaren Plattformnamen unter den Icons.
- Reihenfolge soll links nach rechts nach Relevanz/Popularität im deutschen Markt abfallen.
- Externe Icon-CDN-Lösung wurde verworfen, nachdem Icons im Browser nicht zuverlässig geladen wurden.
- Auf lokale bzw. eingebettete SVG-Icons umgestellt. **Icon-Design/Markentreue ist noch nicht abgeschlossen und wird später weiter bearbeitet.**

### Offene Punkte / nächster Einstieg

1. Brand-Icons finalisieren: möglichst originale, klar erkennbare Markenoptik für Instagram, Facebook, TikTok, LinkedIn, Pinterest, X, WhatsApp, Messenger, Telegram, Signal, WordPress, Wix, Joomla, Webflow usw.
2. Reihenfolge pro Gruppe anhand deutscher Nutzung/Relevanz final festlegen.
3. Danach Share-Funktion technisch modellieren und schrittweise implementieren:
   - Web Share / native Share für Datei + Text, wo möglich.
   - direkte Share-Links für unterstützte Plattformen.
   - später OAuth/API nur dort, wo echter Nutzen für MVP/zahlende Nutzer besteht.
   - Website/CMS: zunächst Embed/Copy/Download, direkte API-Integrationen später.
4. Promo-Ausgabe als Share-Paket definieren: primär MP4/H.264, voraussichtlich 1:1 für MVP; weitere Formate erst später.
5. UTM-Tracking pro Zielkanal vor echter Veröffentlichung ergänzen.

### Wichtige Produktregel

**DFBK verändert nicht die ausgeführte Handwerks-/Friseur-Arbeit.** DFBK optimiert die Darstellung und erzeugt Marketing-Content aus einem Foto der bereits erledigten Arbeit.

### Relevante Commits vom 01.10.2026

- `13af9803158058888e21955e14c613e174e39e4b` — Premium processing transition / blurred image fill structure
- `6efb0e8b14d65aa01f939120cb82fb227b6628bb` — Glass/blur + premium transition styles
- `0a480f7892b534dac3882ae69ec7ee24dba40c44` — Haircut transition and `Nach dem Schnitt` scene
- `772972426c314b2ea11cc6db259265a143c245c9` — Timing / scissors-comb animation
- `ef1a70fa39866b958428f8664972e0c8b4507476` — Share-Hub styles prototype
- `0d771115b8fb09fc33a2bdb21f792d0225914c3e` — Product-oriented Share-Hub page structure
- `5fdc8dec565ec34d93c35f887b27236b7cf53af1` — Compact icon-only share zones
- `4363863fcbe996e8c014cfba0a8210f37098c9d2` — Compact share-zone styling
- `b97805ca90ee94fcc7ef646236774e13e67b9417` — Embedded/local brand icon approach
- `a4716b1196e61570be977c79afec496b410eedc5` — Embedded brand icon styling

### Tagesabschluss

**Arbeit für heute beendet.** Nächster Fokus bei Wiederaufnahme: zuerst die Brand-Icons im Share-Hub sauber finalisieren, danach technische Share-Funktionalität.
