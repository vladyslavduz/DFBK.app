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
const IMAGE_OPTIMIZATION_QUALITY = 'max';
const IMAGE_OUTPUT_FORMAT = 'jpeg';
const IMAGE_OUTPUT_COMPRESSION = '95';

const OPTIMIZATION_PROMPT = [
  'Professionally optimize this photo of completed work for high-quality business marketing.',
  'Preserve the actual completed work, its real materials, geometry, construction details, surface colors and realistic appearance.',
  'Improve lighting, exposure, white balance, natural color reproduction, contrast, clarity, perspective and overall photographic presentation where appropriate.',
  'Carefully improve framing or crop only when it clearly improves presentation without hiding or changing relevant completed work.',
  'Detect and carefully remove only obvious temporary visual clutter that is clearly not part of the completed work, such as tools, cables, extension cords, buckets, bottles, cans, packaging, cloths, temporary work accessories and small construction debris.',
  'When temporary clutter is removed, reconstruct the revealed background naturally and consistently with the surrounding real scene.',
  'Do not redesign, repair, beautify or materially alter the actual completed work.',
  'Do not change real construction elements, installed components, material type, geometry, dimensions, surface color or meaningful defects of the completed work unless a change is strictly photographic correction rather than alteration of the work itself.',
  'Do not invent new construction elements, materials, decorations, fixtures, furniture, branding or details.',
  'Do not make the result look staged, synthetic or AI-generated.',
  'The result must remain photorealistic and look like a professionally taken photograph of the same real completed work.',
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
      [input.imageBytes],
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
