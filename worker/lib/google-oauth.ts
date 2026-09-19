import type { Env } from './env';


const GOOGLE_AUTH_URL =
  'https://accounts.google.com/o/oauth2/v2/auth';

const GOOGLE_TOKEN_URL =
  'https://oauth2.googleapis.com/token';

const GOOGLE_USERINFO_URL =
  'https://openidconnect.googleapis.com/v1/userinfo';


export type GoogleUser = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};


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


export function createGoogleOAuthState(): string {

  return bytesToBase64Url(
    crypto.getRandomValues(
      new Uint8Array(32)
    )
  );
}


export function buildGoogleStateCookie(
  state: string
): string {

  return [
    `dfbk_google_oauth_state=${state}`,
    'Path=/api/auth/google',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=600',
  ].join('; ');
}


export function clearGoogleStateCookie(): string {

  return [
    'dfbk_google_oauth_state=',
    'Path=/api/auth/google',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ].join('; ');
}


export function buildGoogleAuthorizationUrl(
  env: Env,
  state: string
): string {

  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error(
      'GOOGLE_CLIENT_ID is not configured'
    );
  }

  if (!env.GOOGLE_REDIRECT_URI) {
    throw new Error(
      'GOOGLE_REDIRECT_URI is not configured'
    );
  }


  const url =
    new URL(GOOGLE_AUTH_URL);


  url.searchParams.set(
    'client_id',
    env.GOOGLE_CLIENT_ID
  );

  url.searchParams.set(
    'redirect_uri',
    env.GOOGLE_REDIRECT_URI
  );

  url.searchParams.set(
    'response_type',
    'code'
  );

  url.searchParams.set(
    'scope',
    'openid email profile'
  );

  url.searchParams.set(
    'state',
    state
  );

  url.searchParams.set(
    'include_granted_scopes',
    'true'
  );


  return url.toString();
}


export async function exchangeGoogleCode(
  env: Env,
  code: string
): Promise<string> {

  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error(
      'GOOGLE_CLIENT_ID is not configured'
    );
  }

  if (!env.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'GOOGLE_CLIENT_SECRET is not configured'
    );
  }

  if (!env.GOOGLE_REDIRECT_URI) {
    throw new Error(
      'GOOGLE_REDIRECT_URI is not configured'
    );
  }


  const body =
    new URLSearchParams({
      code,
      client_id:
        env.GOOGLE_CLIENT_ID,
      client_secret:
        env.GOOGLE_CLIENT_SECRET,
      redirect_uri:
        env.GOOGLE_REDIRECT_URI,
      grant_type:
        'authorization_code',
    });


  const response =
    await fetch(
      GOOGLE_TOKEN_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },

        body,
      }
    );


  if (!response.ok) {

    const errorText =
      await response.text();

    console.error(
      'GOOGLE_TOKEN_ERROR',
      response.status,
      errorText
    );

    throw new Error(
      'Google authorization code exchange failed'
    );
  }


  const data =
    await response.json<{
      access_token?: string;
    }>();


  if (!data.access_token) {
    throw new Error(
      'Google access token missing'
    );
  }


  return data.access_token;
}


export async function fetchGoogleUser(
  accessToken: string
): Promise<GoogleUser> {

  const response =
    await fetch(
      GOOGLE_USERINFO_URL,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    );


  if (!response.ok) {

    const errorText =
      await response.text();

    console.error(
      'GOOGLE_USERINFO_ERROR',
      response.status,
      errorText
    );

    throw new Error(
      'Google userinfo request failed'
    );
  }


  const user =
    await response.json<GoogleUser>();


  if (
    !user.sub ||
    !user.email
  ) {
    throw new Error(
      'Google userinfo is incomplete'
    );
  }


  return user;
}
