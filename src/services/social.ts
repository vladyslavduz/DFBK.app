import { apiRequest, apiRequestWithResponse, type ApiResponse } from '../lib/api';

export type SocialProvider = 'instagram' | 'facebook' | 'linkedin' | 'x';
export type SocialAvailability = 'available' | 'not_configured' | 'in_preparation';
export type SocialConnectionStatus = 'connected' | 'not_connected' | 'reconnect_required';
export type SocialAccountStatus = 'pending' | 'connected' | 'reconnect_required';
export type PublicationStatus = 'pending' | 'processing' | 'published' | 'failed';
export type PublicationMediaSource = 'original' | 'optimized';

export type SocialAccount = {
  connectionId: string;
  accountId: string;
  accountName: string;
  status: SocialAccountStatus;
  connected: boolean;
  expiresAt: string | null;
};

export type SocialConnection = {
  provider: SocialProvider;
  availability: SocialAvailability;
  connected: boolean;
  connectionId: string | null;
  accountId: string | null;
  accountName: string | null;
  status: SocialConnectionStatus;
  accounts: SocialAccount[];
};

export type PublicationResult = {
  jobId: string;
  provider: 'instagram' | 'facebook';
  status: PublicationStatus;
  mediaId: string;
  mediaSource: PublicationMediaSource;
  externalPostId: string | null;
  url: string | null;
  error: string | null;
  retryAllowed: boolean;
};

export type PublicationResponse = {
  ok: true;
  requestId: string;
  results: PublicationResult[];
};

export type PublishPayload = {
  providers: Array<'instagram' | 'facebook'>;
  caption: string;
  useOptimizedImage: boolean;
  mediaId: string;
};

const providers: SocialProvider[] = ['instagram', 'facebook', 'linkedin', 'x'];

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function normalizeAccount(value: unknown): SocialAccount {
  const account = value as Partial<SocialAccount>;
  if (
    !account || !isString(account.connectionId) || !isString(account.accountId) ||
    !isString(account.accountName) || !['pending', 'connected', 'reconnect_required'].includes(String(account.status)) ||
    typeof account.connected !== 'boolean' ||
    !(account.expiresAt === null || isString(account.expiresAt))
  ) throw new Error('INVALID_SOCIAL_CONNECTIONS_RESPONSE');
  return account as SocialAccount;
}

function normalizeConnection(value: unknown): SocialConnection {
  const connection = value as Partial<SocialConnection>;
  if (
    !connection || !providers.includes(connection.provider as SocialProvider) ||
    !['available', 'not_configured', 'in_preparation'].includes(String(connection.availability)) ||
    typeof connection.connected !== 'boolean' ||
    !(connection.connectionId === null || isString(connection.connectionId)) ||
    !(connection.accountId === null || isString(connection.accountId)) ||
    !(connection.accountName === null || isString(connection.accountName)) ||
    !['connected', 'not_connected', 'reconnect_required'].includes(String(connection.status)) ||
    !Array.isArray(connection.accounts)
  ) throw new Error('INVALID_SOCIAL_CONNECTIONS_RESPONSE');

  return {
    ...(connection as SocialConnection),
    accounts: connection.accounts.map(normalizeAccount),
  };
}

export function normalizeConnections(value: unknown): SocialConnection[] {
  const result = value as { ok?: unknown; connections?: unknown };
  if (result?.ok !== true || !Array.isArray(result.connections)) throw new Error('INVALID_SOCIAL_CONNECTIONS_RESPONSE');
  const normalized = result.connections.map(normalizeConnection);
  if (providers.some(provider => normalized.filter(item => item.provider === provider).length !== 1)) {
    throw new Error('INVALID_SOCIAL_CONNECTIONS_RESPONSE');
  }
  return normalized;
}

function normalizePublicationResult(value: unknown): PublicationResult {
  const result = value as Partial<PublicationResult>;
  if (
    !result || !isString(result.jobId) ||
    !['instagram', 'facebook'].includes(String(result.provider)) ||
    !['pending', 'processing', 'published', 'failed'].includes(String(result.status)) ||
    !isString(result.mediaId) ||
    !['original', 'optimized'].includes(String(result.mediaSource)) ||
    !(result.externalPostId === null || isString(result.externalPostId)) ||
    !(result.url === null || isString(result.url)) ||
    !(result.error === null || isString(result.error)) ||
    typeof result.retryAllowed !== 'boolean'
  ) throw new Error('INVALID_PUBLICATION_RESPONSE');
  return result as PublicationResult;
}

export function normalizePublicationResponse(value: unknown): PublicationResponse {
  const result = value as Partial<PublicationResponse>;
  if (result?.ok !== true || !isString(result.requestId) || !Array.isArray(result.results)) throw new Error('INVALID_PUBLICATION_RESPONSE');
  return {
    ok: true,
    requestId: result.requestId,
    results: result.results.map(normalizePublicationResult),
  };
}

export const socialService = {
  getConnections: async () => normalizeConnections(await apiRequest('/social/connections')),

  selectAccount: async (provider: 'instagram' | 'facebook', connectionId: string) =>
    normalizeConnections(await apiRequest(`/social/${provider}/select`, {
      method: 'POST',
      body: JSON.stringify({ connectionId }),
    })),

  disconnect: async (provider: 'instagram' | 'facebook') =>
    normalizeConnections(await apiRequest(`/social/${provider}/disconnect`, {
      method: 'POST',
      body: JSON.stringify({}),
    })),

  connectUrl: (provider: 'instagram' | 'facebook') => `/api/social/${provider}/connect`,

  publish: async (
    projectId: string,
    payload: PublishPayload,
    idempotencyKey: string,
  ): Promise<ApiResponse<PublicationResponse>> => {
    const response = await apiRequestWithResponse(
      `/projects/${encodeURIComponent(projectId)}/publish`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload),
      },
    );
    return {
      ...response,
      data: normalizePublicationResponse(response.data),
    };
  },

  getPublication: async (projectId: string, requestId: string) =>
    normalizePublicationResponse(await apiRequest(
      `/projects/${encodeURIComponent(projectId)}/publications?requestId=${encodeURIComponent(requestId)}`,
    )),
};
