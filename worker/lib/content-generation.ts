import type { Env } from './env';

export type GeneratedMarketingContent = {
  googleBusiness: string;
  socialMedia: string;
  websiteReference: string;
};

type OpenAIResponse = {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

export class ContentGenerationError extends Error {
  constructor(
    public readonly code:
      | 'AI_NOT_CONFIGURED'
      | 'AI_REQUEST_FAILED'
      | 'AI_INVALID_RESPONSE',
    message: string
  ) {
    super(message);
    this.name = 'ContentGenerationError';
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function extractOutputText(response: OpenAIResponse): string | null {
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  return null;
}

function normalizeGeneratedContent(value: unknown): GeneratedMarketingContent | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const googleBusiness = record.googleBusiness;
  const socialMedia = record.socialMedia;
  const websiteReference = record.websiteReference;

  if (
    typeof googleBusiness !== 'string' ||
    typeof socialMedia !== 'string' ||
    typeof websiteReference !== 'string'
  ) {
    return null;
  }

  const normalized = {
    googleBusiness: googleBusiness.trim(),
    socialMedia: socialMedia.trim(),
    websiteReference: websiteReference.trim(),
  };

  if (
    !normalized.googleBusiness ||
    !normalized.socialMedia ||
    !normalized.websiteReference
  ) {
    return null;
  }

  return normalized;
}

export async function generateMarketingContent(
  env: Env,
  input: {
    title: string;
    description: string;
    imageBytes: Uint8Array;
    imageMimeType: string;
  }
): Promise<GeneratedMarketingContent> {
  if (!env.OPENAI_API_KEY) {
    throw new ContentGenerationError(
      'AI_NOT_CONFIGURED',
      'OPENAI_API_KEY is not configured'
    );
  }

  const imageDataUrl = `data:${input.imageMimeType};base64,${bytesToBase64(
    input.imageBytes
  )}`;

  let response: Response;

  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: [
                  'Du erstellst Marketingtexte für DFBK.app für kleine Unternehmen in Deutschland.',
                  'Nutze ausschließlich die sichtbare Arbeit auf dem Bild und die bereitgestellte Projektbeschreibung.',
                  'Erfinde keine Preise, Kundennamen, Adressen, Zertifizierungen, Materialien oder Leistungen, die nicht erkennbar bzw. beschrieben sind.',
                  'Schreibe natürliches, professionelles Deutsch ohne übertriebene Werbesprache.',
                  '',
                  `Projekttitel: ${input.title}`,
                  `Beschreibung der ausgeführten Arbeit: ${input.description}`,
                  '',
                  'Erzeuge genau drei eigenständige Texte:',
                  '1. googleBusiness: kompakter Google-Business-Beitrag, ca. 300–600 Zeichen.',
                  '2. socialMedia: lockerer Social-Media-Beitrag, ca. 300–700 Zeichen, maximal wenige passende Emojis, keine erfundenen Hashtags oder Kontaktdaten.',
                  '3. websiteReference: sachlicher Referenztext für eine Website, ca. 500–900 Zeichen.',
                ].join('\n'),
              },
              {
                type: 'input_image',
                image_url: imageDataUrl,
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'dfbk_generated_marketing_content',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                googleBusiness: { type: 'string' },
                socialMedia: { type: 'string' },
                websiteReference: { type: 'string' },
              },
              required: [
                'googleBusiness',
                'socialMedia',
                'websiteReference',
              ],
            },
          },
        },
      }),
    });
  } catch (error) {
    console.error('OPENAI_GENERATION_NETWORK_ERROR', error);

    throw new ContentGenerationError(
      'AI_REQUEST_FAILED',
      'OpenAI request failed'
    );
  }

  if (!response.ok) {
    const upstreamBody = await response.text().catch(() => '');
    console.error(
      'OPENAI_GENERATION_HTTP_ERROR',
      response.status,
      upstreamBody.slice(0, 1000)
    );

    throw new ContentGenerationError(
      'AI_REQUEST_FAILED',
      `OpenAI request failed with status ${response.status}`
    );
  }

  let payload: OpenAIResponse;

  try {
    payload = (await response.json()) as OpenAIResponse;
  } catch (error) {
    console.error('OPENAI_GENERATION_JSON_ERROR', error);

    throw new ContentGenerationError(
      'AI_INVALID_RESPONSE',
      'OpenAI returned invalid JSON'
    );
  }

  const outputText = extractOutputText(payload);

  if (!outputText) {
    console.error('OPENAI_GENERATION_NO_OUTPUT_TEXT');

    throw new ContentGenerationError(
      'AI_INVALID_RESPONSE',
      'OpenAI response did not contain output text'
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(outputText);
  } catch (error) {
    console.error('OPENAI_GENERATION_OUTPUT_PARSE_ERROR', error);

    throw new ContentGenerationError(
      'AI_INVALID_RESPONSE',
      'OpenAI structured output could not be parsed'
    );
  }

  const normalized = normalizeGeneratedContent(parsed);

  if (!normalized) {
    console.error('OPENAI_GENERATION_OUTPUT_VALIDATION_ERROR');

    throw new ContentGenerationError(
      'AI_INVALID_RESPONSE',
      'OpenAI structured output failed validation'
    );
  }

  return normalized;
}
