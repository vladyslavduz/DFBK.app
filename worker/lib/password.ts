const ITERATIONS = 100_000;
const HASH = 'SHA-256';
const KEY_LENGTH = 256;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < a.length; i++) {
    difference |= a[i] ^ b[i];
  }

  return difference === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: HASH,
      salt,
      iterations: ITERATIONS,
    },
    passwordKey,
    KEY_LENGTH
  );

  const hash = new Uint8Array(derivedBits);

  return [
    'pbkdf2',
    'sha256',
    ITERATIONS.toString(),
    bytesToBase64(salt),
    bytesToBase64(hash),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split('$');

  if (parts.length !== 5) {
    return false;
  }

  const [algorithm, hashName, iterationsText, saltBase64, hashBase64] =
    parts;

  if (algorithm !== 'pbkdf2' || hashName !== 'sha256') {
    return false;
  }

  const iterations = Number(iterationsText);

  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false;
  }

  try {
    const salt = base64ToBytes(saltBase64);
    const expectedHash = base64ToBytes(hashBase64);

    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations,
      },
      passwordKey,
      expectedHash.length * 8
    );

    const actualHash = new Uint8Array(derivedBits);

    return safeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}
