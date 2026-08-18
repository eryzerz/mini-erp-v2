import type { LoginResponse } from "@repo/contracts";

// Same-origin by default (wayfinder tickets 08/10): the browser only talks to
// its own origin — the Vercel edge rewrites /api/v1/* to the matching service
// in production, and each zone's next.config mirrors those rewrites locally.
// No per-zone API env is needed (ticket 10), and same-origin zones SHARE
// sessionStorage, which is how the refresh token survives zone hops.
const API_URL = "";

const REFRESH_KEY = "slm.refreshToken";

export const apiUrl = (path: string): string => `${API_URL}/api/v1${path}`;

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

export const storeRefreshToken = (token: string): void => {
  sessionStorage.setItem(REFRESH_KEY, token);
};

export const getRefreshToken = (): string | null => sessionStorage.getItem(REFRESH_KEY);

export const clearSession = (): void => {
  accessToken = null;
  sessionStorage.removeItem(REFRESH_KEY);
};

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(apiUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    clearSession();
    return null;
  }
  const data = (await response.json()) as { accessToken: string; refreshToken: string };
  setAccessToken(data.accessToken);
  storeRefreshToken(data.refreshToken);
  return data.accessToken;
};

const parseError = async (
  response: Response,
): Promise<Error & { code?: string; details?: unknown; status: number }> => {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string; code?: string; details?: unknown };
  } | null;
  const message = body?.error?.message ?? `Request failed (${response.status})`;
  const error = new Error(message) as Error & { code?: string; details?: unknown; status: number };
  error.code = body?.error?.code;
  error.details = body?.error?.details;
  error.status = response.status;
  return error;
};

export const api = {
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const perform = async (token: string | null): Promise<Response> =>
      fetch(apiUrl(path), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });

    let response = await perform(accessToken);

    if (response.status === 401 && getRefreshToken()) {
      // Single-flight the refresh so concurrent 401s share one rotation.
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const newToken = await refreshPromise;
      refreshPromise = null;
      if (newToken) {
        response = await perform(newToken);
      }
    }

    if (!response.ok) {
      throw await parseError(response);
    }

    return response.json() as Promise<T>;
  },

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  },

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  },

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  },

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  },
};

export const loginRequest = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return response.json() as Promise<LoginResponse>;
};
