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
