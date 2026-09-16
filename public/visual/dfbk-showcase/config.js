(function () {
  "use strict";

  const image = (name) => `assets/images/${name}`;

  window.DFBK_VISUAL_CONFIG = {
    timing: {
      capture: 2400,
      description: 3000,
      ai: 4000,
      lead: 3000,
      module: 12400,
      overlap: 400,
      cycle: 36400,
      moduleStarts: [0, 12000, 24000]
    },
    modules: [
      {
        id: "renovierung",
        label: "Renovierung",
        icon: "renovierung",
        images: {
          original: image("renovierung-before.webp"),
          result: image("renovierung-after.webp"),
          optimized: image("renovierung-after.webp"),
          phone: image("renovierung-phone.webp")
        },
        capture: { title: "Vorher fotografieren", subtitle: "Ausgangszustand aufnehmen" },
        description: {
          title: "Ergebnis zeigen",
          helper: "Sprechen, schreiben oder weitere Fotos hinzufügen",
          transcript: "Wände renoviert, neuen Boden verlegt und den Raum modern gestaltet."
        },
        ai: {
          beforeLabel: "Vorher",
          afterLabel: "Nachher",
          title: "Wohnraum komplett renoviert",
          text: "Aus einem unfertigen Raum entstand ein heller, moderner Wohnbereich."
        },
        lead: {
          title: "Aus Ideen werden Lebensräume.",
          text: "Komplett renoviert – hell, modern und bereit für ein neues Kapitel.",
          type: "Neue Kundenanfrage",
          message: "Hallo, können Sie mir ein Angebot machen?",
          success: "Neue Anfrage"
        },
        nav: ["Foto", "Ergebnis", "DFBK AI", "Kunde"]
      },
      {
        id: "nagelstudio",
        label: "Nagelstudio",
        icon: "nagelstudio",
        images: {
          original: image("nails-before.webp"),
          result: image("nails-after.webp"),
          optimized: image("nails-optimized.webp"),
          phone: image("nails-phone.webp")
        },
        capture: { title: "Vorher fotografieren", subtitle: "Natürliche Nägel aufnehmen" },
        description: {
          title: "Ergebnis zeigen",
          helper: "Sprechen, schreiben oder weitere Fotos hinzufügen",
          transcript: "Gel-Modellage in Nude mit feinen Goldlinien."
        },
        ai: {
          beforeLabel: "Original",
          afterLabel: "Optimiert",
          title: "Elegante Nude Nails",
          text: "Zeitlose Eleganz mit feinen Goldlinien – individuell gearbeitet."
        },
        lead: {
          title: "Elegante Nude Nails",
          text: "Zeitlose Eleganz für jeden Anlass – jetzt Termin sichern.",
          type: "Neue Terminanfrage",
          message: "Hallo, ist am Freitag noch ein Termin frei?",
          success: "Neue Terminanfrage"
        },
        nav: ["Foto", "Ergebnis", "DFBK AI", "Termin"]
      },
      {
        id: "konditorei",
        label: "Konditorei",
        icon: "konditorei",
        images: {
          original: image("cake-original.webp"),
          result: image("cake-result.webp"),
          optimized: image("cake-optimized.webp"),
          phone: image("cake-phone.webp")
        },
        capture: { title: "Torte fotografieren", subtitle: "Das echte Ergebnis aufnehmen" },
        description: {
          title: "Ergebnis beschreiben",
          helper: "Sprechen, schreiben oder weitere Fotos hinzufügen",
          transcript: "Hausgemachte Geburtstagstorte mit Vanillecreme und frischen Beeren."
        },
        ai: {
          beforeLabel: "Original",
          afterLabel: "Optimiert",
          title: "Hausgemachte Geburtstagstorte",
          text: "Vanillecreme und frische Beeren – liebevoll hausgemacht."
        },
        lead: {
          title: "Hausgemachte Geburtstagstorte",
          text: "Liebevoll hausgemacht – jetzt Wunschtermin anfragen.",
          type: "Neue Bestellung",
          message: "Hallo, können Sie für Samstag eine Geburtstagstorte machen?",
          success: "Neue Bestellung"
        },
        nav: ["Foto", "Beschreibung", "DFBK AI", "Bestellung"]
      }
    ]
  };
}());
