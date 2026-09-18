import type { Env } from './env';


type SendVerificationEmailOptions = {
  to: string;
  verificationUrl: string;
};


export async function sendVerificationEmail(
  env: Env,
  options: SendVerificationEmailOptions
): Promise<void> {

  if (!env.RESEND_API_KEY) {
    throw new Error(
      'RESEND_API_KEY is not configured'
    );
  }

  if (!env.EMAIL_FROM) {
    throw new Error(
      'EMAIL_FROM is not configured'
    );
  }


  const response =
    await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',

        headers: {
          'Authorization':
            `Bearer ${env.RESEND_API_KEY}`,

          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          from: env.EMAIL_FROM,

          to: [options.to],

          subject:
            'E-Mail-Adresse bestätigen – DFBK.app',

          html: `
            <div style="
              font-family:
                Arial,
                Helvetica,
                sans-serif;
              color:#17212B;
              line-height:1.6;
            ">

              <h2 style="
                color:#102A43;
              ">
                E-Mail-Adresse bestätigen
              </h2>

              <p>
                Vielen Dank für deine Registrierung bei
                <strong>DFBK.app</strong>.
              </p>

              <p>
                Bitte bestätige deine E-Mail-Adresse,
                indem du auf den folgenden Button klickst.
              </p>

              <p style="margin:28px 0;">
                <a
                  href="${options.verificationUrl}"
                  style="
                    display:inline-block;
                    background:#2563EB;
                    color:#FFFFFF;
                    text-decoration:none;
                    padding:12px 20px;
                    border-radius:8px;
                    font-weight:600;
                  "
                >
                  E-Mail bestätigen
                </a>
              </p>

              <p>
                Der Link ist 24 Stunden gültig.
              </p>

              <p style="
                color:#64748B;
                font-size:14px;
              ">
                Falls du dich nicht bei DFBK.app
                registriert hast, kannst du diese
                E-Mail ignorieren.
              </p>

            </div>
          `,
        }),
      }
    );


  if (!response.ok) {

    const errorText =
      await response.text();

    console.error(
      'RESEND_EMAIL_ERROR',
      response.status,
      errorText
    );

    throw new Error(
      'Verification email could not be sent'
    );
  }
}
