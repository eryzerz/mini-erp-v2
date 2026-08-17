/**
 * Cross-service HTTP client for the fleet.
 *
 * Server-to-server calls forward the caller's user JWT (so the receiving
 * service validates and scopes exactly as it would for a direct user
 * request). The internal API key rides along as an additional machine
 * credential for arriving at a service without a user token; services may
 * require it explicitly with a guard.
 */
export class S2SClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalKey: string,
  ) {}

  async get<T>(path: string, token?: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "x-internal-key": this.internalKey,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Upstream ${response.status} for GET ${path}`);
    }
    return response.json() as Promise<T>;
  }
}

export const createS2SClient = (baseUrl: string): S2SClient => {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) {
    throw new Error("INTERNAL_API_KEY is required to create an S2S client");
  }
  return new S2SClient(baseUrl, internalKey);
};
