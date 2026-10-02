export type PricingFeature = {
  label: string;
  availability: 'available' | 'planned';
};

export type PricingPlan = {
  id: 'trial' | 'pro';
  eyebrow: string;
  name: string;
  value: string;
  description: string;
  audience: string;
  badge?: string;
  price: string | null;
  billingPeriod: string | null;
  projectLimit: number | null;
  features: PricingFeature[];
  cta: string;
  ctaTo: string;
  note: string | null;
};

export const pricingBusinessTodo = {
  proPriceApproved: false,
  freeTrialApproved: true,
  trialLimitApproved: true,
  cardRequiredApproved: false,
  trialDurationApproved: false,
  annualBillingApproved: false,
  annualDiscountApproved: false,
  cancellationPolicyApproved: false,
  postSubscriptionProjectPolicyApproved: false,
  vatDisplayApproved: false,
} as const;

export const pricingConfig = {
  headline: 'Erst ausprobieren. Dann entscheiden.',
  subtitle: 'Teste DFBK.app mit deiner eigenen Arbeit. Wenn es dir hilft, mach einfach weiter.',
  trustLine: ['Einfach starten', 'Keine komplizierten Tarife'],
  plans: [
    {
      id: 'trial',
      eyebrow: 'ZUM KENNENLERNEN',
      name: 'Ausprobieren',
      value: 'Sieh zuerst, was DFBK.app aus deiner Arbeit macht.',
      description: 'Lade ein eigenes Foto hoch und teste DFBK.app mit bis zu zwei eigenen Projekten.',
      audience: 'Für deinen ersten Eindruck.',
      price: null,
      billingPeriod: null,
      projectLimit: 2,
      features: [
        { label: '2 Projekte kostenlos ausprobieren', availability: 'available' },
        { label: 'Eigenes Foto verwenden', availability: 'available' },
        { label: 'Optionale Zusatzinfo ergänzen', availability: 'available' },
        { label: 'Inhalte von DFBK.app erstellen lassen', availability: 'available' },
        { label: 'Ergebnis direkt ansehen', availability: 'available' },
      ],
      cta: 'Kostenlos ausprobieren',
      ctaTo: '/register',
      note: 'Ideal, um DFBK.app mit deiner eigenen Arbeit kennenzulernen.',
    },
    {
      id: 'pro',
      eyebrow: 'FÜR DEN ALLTAG',
      name: 'DFBK Pro',
      value: 'Für Betriebe, die ihre Arbeit regelmäßig sichtbar machen wollen.',
      description: 'Der Pro-Zugang ist für die laufende Nutzung ohne Projektlimit vorgesehen. Preis und Zahlungsmodell werden vor dem Bezahlstart festgelegt.',
      audience: 'Für deinen laufenden Marketing-Alltag.',
      badge: 'BELIEBT',
      // BUSINESS TODO: insert the approved price here. Do not invent a public price.
      price: null,
      billingPeriod: 'Monat',
      projectLimit: null,
      features: [
        { label: 'Projekte ohne festes Projektlimit', availability: 'available' },
        { label: 'Professionelle Inhalte für deine Arbeit', availability: 'available' },
        { label: 'Texte für Google, Website und Social Media', availability: 'available' },
        { label: 'Bilder für deinen Online-Auftritt vorbereiten', availability: 'available' },
        { label: 'Projekte und Referenzen speichern', availability: 'available' },
        { label: 'Inhalte kopieren und herunterladen', availability: 'available' },
        { label: 'Unbegrenzte Spracheingabe im Business-Zugang', availability: 'available' },
        { label: 'Inhalte direkt über das System-Menü teilen', availability: 'available' },
        { label: 'Direkte Business-Integrationen', availability: 'planned' },
      ],
      // Until billing exists, do not pretend that Pro can already be purchased.
      cta: 'Zuerst ausprobieren',
      ctaTo: '/register',
      // BUSINESS TODO: replace with cancellation copy only after subscription terms are approved.
      note: 'Preis und Zahlungsmodell werden vor dem Start der Bezahlversion festgelegt.',
    },
  ] satisfies PricingPlan[],
  faq: [
    {
      question: 'Kann ich DFBK.app zuerst ausprobieren?',
      answer: 'Ja. Mit dem Testzugang kannst du zwei eigene Projekte kostenlos erstellen und den kompletten Ablauf kennenlernen.',
    },
    {
      question: 'Was passiert nach dem Test?',
      answer: 'Nach zwei Testprojekten entscheidest du, ob du mit DFBK Pro weitermachen möchtest. Der genaue Upgrade-Ablauf wird mit dem Billing-Modell fertiggestellt.',
    },
    {
      question: 'Muss ich sofort einen Tarif wählen?',
      answer: 'Nein. Du kannst zuerst zwei Projekte mit dem Testzugang erstellen.',
    },
    {
      question: 'Kann ich meinen Tarif später ändern?',
      answer: 'Ein Tarifwechsel ist vorgesehen. Die genaue Self-Service-Abwicklung wird mit dem Billing-Modell festgelegt.',
    },
    {
      question: 'Kann ich jederzeit kündigen?',
      answer: 'Die endgültigen Kündigungsbedingungen werden zusammen mit dem Bezahlmodell festgelegt und vor Abschluss transparent angezeigt.',
    },
    {
      question: 'Was passiert mit meinen Projekten, wenn ich kündige?',
      answer: 'Die Regelung für gespeicherte Projekte nach Vertragsende ist noch eine offene Business-Entscheidung und wird vor dem Bezahlstart festgelegt.',
    },
  ],
} as const;
