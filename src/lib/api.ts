import { appConfig } from '../config/app';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type ApiResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
};

async function performApiRequest<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    ...options,
    credentials: 'same-origin',
    headers,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, body?.error || 'API_ERROR');
  }

  return {
    data: body as T,
    status: response.status,
    headers: response.headers,
  };
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return (await performApiRequest<T>(path, options)).data;
}

export async function apiRequestWithResponse<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  return performApiRequest<T>(path, options);
}
