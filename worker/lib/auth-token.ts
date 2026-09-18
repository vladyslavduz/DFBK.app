const EMAIL_VERIFICATION_HOURS = 24;


function bytesToBase64Url(
  bytes: Uint8Array
): string {

  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}


function bytesToHex(
  bytes: Uint8Array
): string {

  return Array.from(bytes)
    .map(
      byte =>
        byte.toString(16).padStart(2, '0')
    )
    .join('');
}


export function createAuthToken(): string {

  const bytes =
    crypto.getRandomValues(
      new Uint8Array(32)
    );

  return bytesToBase64Url(bytes);
}


export async function hashAuthToken(
  token: string
): Promise<string> {

  const digest =
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(token)
    );

  return bytesToHex(
    new Uint8Array(digest)
  );
}


export function getEmailVerificationExpiry(): Date {

  return new Date(
    Date.now() +
      EMAIL_VERIFICATION_HOURS *
        60 *
        60 *
        1000
  );
}
