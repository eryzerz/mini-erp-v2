/**
 * Cross-service HTTP client for the fleet.
 *
 * Server-to-server calls forward the caller's user JWT (so the receiving
 * service validates and scopes exactly as it would for a direct user
 * request). The internal API key rides along as an additional machine
 * credential for arriving at a service without a user token; services may
 * require it explicitly with an InternalKeyGuard (@Internal()).
 */
export class S2SClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalKey: string,
  ) {}

  private async request<T>(path: string, token: string | undefined, allow404: boolean): Promise<T | null> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "x-internal-key": this.internalKey,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404 && allow404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Upstream ${response.status} for ${path}`);
    }
    return response.json() as Promise<T>;
  }

  async get<T>(path: string, token?: string): Promise<T> {
    return (await this.request<T>(path, token, false)) as T;
  }

  async getOrNull<T>(path: string): Promise<T | null> {
    return this.request<T>(path, undefined, true);
  }
}

export const createS2SClient = (baseUrl: string): S2SClient => {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) {
    throw new Error("INTERNAL_API_KEY is required to create an S2S client");
  }
  return new S2SClient(baseUrl, internalKey);
};
