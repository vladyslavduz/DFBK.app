import type { Env } from './env';

export type OptimizedImage = {
  bytes: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
};

type OpenAIImageEditResponse = {
  data?: Array<{
    b64_json?: string;
  }>;
  output_format?: 'jpeg' | 'png' | 'webp';
};

export class ImageOptimizationError extends Error {
  constructor(
    public readonly code:
      | 'IMAGE_OPTIMIZATION_NOT_CONFIGURED'
      | 'IMAGE_OPTIMIZATION_FAILED'
      | 'IMAGE_OPTIMIZATION_INVALID_RESPONSE',
    message: string
  ) {
    super(message);
    this.name = 'ImageOptimizationError';
  }
}

const IMAGE_OPTIMIZATION_MODEL = 'gpt-image-2.5-sunburst';
const IMAGE_OPTIMIZATION_QUALITY = 'high';
const IMAGE_OUTPUT_FORMAT = 'jpeg';
const IMAGE_OUTPUT_COMPRESSION = '95';

const OPTIMIZATION_PROMPT = [
  'Professionally optimize this real business photo for high-quality marketing while preserving the truth of what the business actually produced, performed, presented or photographed.',
  'The photo may come from any small-business category, including trades and repair work, hair and beauty services, food and bakery products, tailoring and handmade goods, automotive services, photography, hospitality, retail, wellness, crafts or other professional services.',
  'First identify the main subject and the actual result that should be presented to customers. Preserve that real subject, result, product, service outcome, materials, colors, geometry, proportions, branding and realistic appearance.',
  'Improve only the photographic presentation where appropriate: lighting, exposure, white balance, natural color reproduction, contrast, clarity, sharpness, perspective, framing and crop.',
  'Detect and carefully remove only obvious temporary visual clutter that is clearly unrelated to the intended subject or final presentation. Depending on the scene, this can include tools, cables, buckets, bottles, packaging, cloths, scraps, disposable containers, temporary work accessories, accidental background objects or other small distractions.',
  'Do not remove legitimate products, ingredients, tools intentionally shown as part of the service, decorative elements, equipment, people, branding or contextual objects when they are relevant to the business result or presentation.',
  'When temporary clutter is removed, reconstruct the revealed background naturally and consistently with the surrounding real scene.',
  'Do not redesign, repair, beautify or materially alter the actual business result, person, product, food item, garment, vehicle, room, object or service outcome.',
  'Do not change real colors, materials, construction details, product shape, hairstyle, skin features, food structure, garment cut, vehicle parts, photographed subject identity, proportions or meaningful defects unless the change is strictly a photographic correction rather than an alteration of reality.',
  'Do not invent new products, decorations, fixtures, ingredients, features, branding, construction elements, materials or details.',
  'Do not make the result look staged, synthetic or AI-generated.',
  'The result must remain photorealistic and look like a professionally prepared photograph of the same real subject and the same real business result.',
].join('\n');

function inputExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'bin';
}

function decodeBase64(value: string): Uint8Array {
  let binary: string;

  try {
    binary = atob(value);
  } catch {
    throw new ImageOptimizationError(
      'IMAGE_OPTIMIZATION_INVALID_RESPONSE',
      'OpenAI returned invalid base64 image data'
    );
  }

  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function detectImageFormat(
  bytes: Uint8Array
): OptimizedImage['mimeType'] | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

function extensionForMimeType(
  mimeType: OptimizedImage['mimeType']
): OptimizedImage['extension'] {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  return 'webp';
}

function expectedMimeType(
  outputFormat: OpenAIImageEditResponse['output_format']
): OptimizedImage['mimeType'] | null {
  if (outputFormat === 'jpeg') return 'image/jpeg';
  if (outputFormat === 'png') return 'image/png';
  if (outputFormat === 'webp') return 'image/webp';
  return null;
}

export async function optimizeImage(
  env: Env,
  input: {
    imageBytes: Uint8Array;
    imageMimeType: string;
  }
): Promise<OptimizedImage> {
  if (!env.OPENAI_API_KEY) {
    throw new ImageOptimizationError(
      'IMAGE_OPTIMIZATION_NOT_CONFIGURED',
      'OPENAI_API_KEY is not configured'
    );
  }

  const formData = new FormData();
  formData.set('model', IMAGE_OPTIMIZATION_MODEL);
  formData.set('prompt', OPTIMIZATION_PROMPT);
  formData.set('quality', IMAGE_OPTIMIZATION_QUALITY);
  formData.set('size', 'auto');
  formData.set('background', 'opaque');
  formData.set('output_format', IMAGE_OUTPUT_FORMAT);
  formData.set('output_compression', IMAGE_OUTPUT_COMPRESSION);
  formData.set(
    'image',
    new File(
      [new Uint8Array(input.imageBytes).buffer],
      `original.${inputExtension(input.imageMimeType)}`,
      { type: input.imageMimeType }
    )
  );

  let response: Response;

  try {
    response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: formData,
      signal: AbortSignal.timeout(180_000),
    });
  } catch (error) {
    console.error('IMAGE_OPTIMIZATION_NETWORK_ERROR', error);

    throw new ImageOptimizationError(
      'IMAGE_OPTIMIZATION_FAILED',
      'OpenAI image optimization request failed'
    );
  }

  if (!response.ok) {
    console.error('IMAGE_OPTIMIZATION_HTTP_ERROR', response.status);

    throw new ImageOptimizationError(
      'IMAGE_OPTIMIZATION_FAILED',
      `OpenAI image optimization failed with status ${response.status}`
    );
  }

  let payload: OpenAIImageEditResponse;

  try {
    payload = (await response.json()) as OpenAIImageEditResponse;
  } catch (error) {
    console.error('IMAGE_OPTIMIZATION_RESPONSE_JSON_ERROR', error);

    throw new ImageOptimizationError(
      'IMAGE_OPTIMIZATION_INVALID_RESPONSE',
      'OpenAI image optimization returned invalid JSON'
    );
  }

  const encodedImage = payload.data?.[0]?.b64_json;

  if (!encodedImage) {
    console.error('IMAGE_OPTIMIZATION_RESPONSE_IMAGE_MISSING');

    throw new ImageOptimizationError(
      'IMAGE_OPTIMIZATION_INVALID_RESPONSE',
      'OpenAI image optimization returned no image data'
    );
  }

  const bytes = decodeBase64(encodedImage);

  if (bytes.length === 0) {
    throw new ImageOptimizationError(
      'IMAGE_OPTIMIZATION_INVALID_RESPONSE',
      'OpenAI image optimization returned an empty image'
    );
  }

  const detectedMimeType = detectImageFormat(bytes);
  const declaredMimeType = expectedMimeType(payload.output_format);

  if (!detectedMimeType) {
    console.error('IMAGE_OPTIMIZATION_UNKNOWN_IMAGE_SIGNATURE');

    throw new ImageOptimizationError(
      'IMAGE_OPTIMIZATION_INVALID_RESPONSE',
      'OpenAI image optimization returned an unsupported image format'
    );
  }

  if (declaredMimeType && declaredMimeType !== detectedMimeType) {
    console.error('IMAGE_OPTIMIZATION_FORMAT_MISMATCH');

    throw new ImageOptimizationError(
      'IMAGE_OPTIMIZATION_INVALID_RESPONSE',
      'OpenAI image optimization format metadata did not match image bytes'
    );
  }

  return {
    bytes,
    mimeType: detectedMimeType,
    extension: extensionForMimeType(detectedMimeType),
  };
}
