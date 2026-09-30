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
  features: PricingFeature[];
  cta: string;
  ctaTo: string;
  note: string | null;
};

export const pricingBusinessTodo = {
  proPriceApproved: false,
  freeTrialApproved: false,
  trialLimitApproved: false,
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
      description: 'Lade ein eigenes Foto hoch und erlebe den kompletten Ablauf selbst.',
      audience: 'Für deinen ersten Eindruck.',
      price: null,
      billingPeriod: null,
      features: [
        { label: 'Eigenes Foto verwenden', availability: 'available' },
        { label: 'Arbeit kurz beschreiben', availability: 'available' },
        { label: 'Inhalte von DFBK.app erstellen lassen', availability: 'available' },
        { label: 'Ergebnis direkt ansehen', availability: 'available' },
      ],
      // BUSINESS TODO: change to "Kostenlos ausprobieren" only after the free-test model is approved.
      cta: 'Ausprobieren',
      ctaTo: '/register',
      note: 'Ideal, um DFBK.app kennenzulernen.',
    },
    {
      id: 'pro',
      eyebrow: 'FÜR DEN ALLTAG',
      name: 'DFBK Pro',
      value: 'Für Betriebe, die ihre Arbeit regelmäßig sichtbar machen wollen.',
      description: 'Mehr Projekte, mehr Kanäle und ein verlässlicher Ablauf für deinen Marketing-Alltag.',
      audience: 'Für deinen laufenden Marketing-Alltag.',
      badge: 'BELIEBT',
      // BUSINESS TODO: insert the approved price here. Do not invent a public price.
      price: null,
      billingPeriod: 'Monat',
      features: [
        { label: 'Mehr Projekte erstellen', availability: 'available' },
        { label: 'Professionelle Inhalte für deine Arbeit', availability: 'available' },
        { label: 'Texte für Google, Website und Social Media', availability: 'available' },
        { label: 'Bilder für deinen Online-Auftritt vorbereiten', availability: 'available' },
        { label: 'Projekte und Referenzen speichern', availability: 'available' },
        { label: 'Inhalte kopieren und herunterladen', availability: 'available' },
      ],
      cta: 'DFBK Pro wählen',
      ctaTo: '/register',
      // BUSINESS TODO: replace with cancellation copy only after subscription terms are approved.
      note: 'Preis und Zahlungsmodell werden vor dem Start der Bezahlversion festgelegt.',
    },
  ] satisfies PricingPlan[],
  faq: [
    {
      question: 'Kann ich DFBK.app zuerst ausprobieren?',
      answer: 'Ja. Der Testzugang ist dafür gedacht, den Ablauf mit deiner eigenen Arbeit kennenzulernen.',
    },
    {
      question: 'Was passiert nach dem Test?',
      answer: 'Du entscheidest anschließend, ob DFBK.app zu deinem Betrieb passt. Die endgültigen Testgrenzen werden vor dem kommerziellen Start festgelegt.',
    },
    {
      question: 'Muss ich sofort einen Tarif wählen?',
      answer: 'Nein. Du kannst zuerst mit dem Testzugang starten und DFBK.app kennenlernen.',
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
