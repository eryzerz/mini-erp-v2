import {
  api,
  apiUrl,
  clearSession,
  getAccessToken,
  getRefreshToken,
  loginRequest,
  setAccessToken,
  storeRefreshToken,
} from "./api";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const makeStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, String(value)),
    removeItem: (key: string) => map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
};

describe("web-shared api client", () => {
  const realFetch = global.fetch;

  beforeAll(() => {
    // The client reads/writes sessionStorage; the node test env has none.
    Object.defineProperty(global, "sessionStorage", {
      configurable: true,
      value: makeStorage(),
    });
  });

  beforeEach(() => {
    sessionStorage.clear();
    setAccessToken(null);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it("builds same-origin /api/v1 paths", () => {
    expect(apiUrl("/auth/me")).toBe("/api/v1/auth/me");
    expect(apiUrl("/customers")).toBe("/api/v1/customers");
  });

  it("round-trips the refresh token in sessionStorage", () => {
    storeRefreshToken("rt-1");
    expect(getRefreshToken()).toBe("rt-1");
    clearSession();
    expect(getRefreshToken()).toBeNull();
  });

  it("sends the access token and parses a typed error envelope", async () => {
    setAccessToken("at-1");
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Customer not found", details: ["x"] } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(api.get("/customers/123")).rejects.toMatchObject({
      message: "Customer not found",
      code: "NOT_FOUND",
      status: 404,
      details: ["x"],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/customers/123",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer at-1" }),
      }),
    );
  });

  it("refreshes once on 401, retries, and single-flights concurrent 401s", async () => {
    setAccessToken("expired");
    storeRefreshToken("rt-1");

    (global.fetch as jest.Mock)
      // two concurrent requests both 401...
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({}, 401))
      // ...one shared refresh...
      .mockResolvedValueOnce(json({ accessToken: "fresh", refreshToken: "rt-2" }))
      // ...both retried with the fresh token.
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ ok: true }));

    const [a, b] = await Promise.all([api.get<{ ok: boolean }>("/a"), api.get<{ ok: boolean }>("/b")]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(getAccessToken()).toBe("fresh");
    expect(getRefreshToken()).toBe("rt-2");
    expect(global.fetch).toHaveBeenCalledTimes(5); // 2 × fail + 1 × refresh + 2 × retry
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/auth/refresh",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("clears the session when refresh is rejected", async () => {
    setAccessToken("expired");
    storeRefreshToken("rt-1");

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({}, 401));

    await expect(api.get("/a")).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("logs in and stores the returned tokens", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      json({ accessToken: "at", refreshToken: "rt", user: { id: "u1" } }),
    );

    const login = await loginRequest("admin@slm.local", "admin123");

    expect(login.accessToken).toBe("at");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "admin@slm.local", password: "admin123" }),
      }),
    );
  });
});
