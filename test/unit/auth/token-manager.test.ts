// Copyright Operaton contributors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  TokenManager,
  clearTokenManagerRegistry,
  getTokenManager,
} from "../../../src/auth/token-manager.js";
import type { OidcAuthConfig } from "../../../src/config.js";

const oidcConfig: OidcAuthConfig = {
  type: "oidc",
  clientId: "test-client",
  clientSecret: "test-secret",
  tokenUrl: "https://auth.example.com/token",
};

function makeTokenResponse(
  token: string,
  expiresIn?: number,
): Response {
  const body = JSON.stringify({
    access_token: token,
    ...(expiresIn !== undefined ? { expires_in: expiresIn } : {}),
    token_type: "Bearer",
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TokenManager", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearTokenManagerRegistry();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    clearTokenManagerRegistry();
  });

  it("fetches a token on cold cache and caches it (AC 1, 7)", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(makeTokenResponse("my-token", 3600));

    const manager = new TokenManager(oidcConfig);
    const token = await manager.getToken();

    expect(token).toBe("my-token");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call![0]).toBe(oidcConfig.tokenUrl);
    expect((call![1] as RequestInit).method).toBe("POST");
  });

  it("returns cached token without a new fetch when cache is warm (AC 2)", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(makeTokenResponse("cached-token", 3600));

    const manager = new TokenManager(oidcConfig);
    await manager.getToken();
    const token = await manager.getToken();

    expect(token).toBe("cached-token");
    expect(fetchSpy).toHaveBeenCalledTimes(1); // only one fetch
  });

  it("fetches a new token when cache is near expiry (< 30s) (AC 3)", async () => {
    vi.useFakeTimers();
    let fetchCount = 0;
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      fetchCount++;
      return Promise.resolve(makeTokenResponse(`token-${fetchCount}`, 60));
    });

    const manager = new TokenManager(oidcConfig);
    const token1 = await manager.getToken();
    expect(token1).toBe("token-1");
    expect(fetchCount).toBe(1);

    // Advance past the 30s buffer threshold (60 - 30 = 30s from now)
    vi.advanceTimersByTime(31_000);

    const token2 = await manager.getToken();
    expect(token2).toBe("token-2");
    expect(fetchCount).toBe(2);
  });

  it("only makes one fetch for concurrent requests — no thundering herd (AC 4)", async () => {
    let resolveToken!: () => void;
    const tokenPromise = new Promise<Response>((resolve) => {
      resolveToken = () => resolve(makeTokenResponse("shared-token", 3600));
    });
    fetchSpy = vi.spyOn(globalThis, "fetch").mockReturnValue(tokenPromise);

    const manager = new TokenManager(oidcConfig);
    const [t1, t2] = await Promise.all([
      manager.getToken(),
      manager.getToken(),
      Promise.resolve().then(() => resolveToken()),
    ]).then(([t1, t2]) => [t1, t2]);

    expect(t1).toBe("shared-token");
    expect(t2).toBe("shared-token");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("throws structured error on non-2xx token endpoint response (AC 5)", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));

    const manager = new TokenManager(oidcConfig);
    await expect(manager.getToken()).rejects.toThrow(
      `[operaton-mcp] OIDC token fetch failed: HTTP 401 from ${oidcConfig.tokenUrl}`,
    );
  });

  it("throws structured error on network error (AC 6)", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("ECONNREFUSED"));

    const manager = new TokenManager(oidcConfig);
    await expect(manager.getToken()).rejects.toThrow(
      "[operaton-mcp] OIDC token fetch failed: ECONNREFUSED",
    );
  });

  it("defaults expiry to 3600s when expires_in is absent (AC 8)", async () => {
    vi.useFakeTimers();
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(makeTokenResponse("no-expiry-token"));

    const manager = new TokenManager(oidcConfig);
    await manager.getToken();

    // Advance 3500s — still within default 3600s - 30s buffer
    vi.advanceTimersByTime(3_500_000);
    const second = await manager.getToken();
    expect(second).toBe("no-expiry-token");
    expect(fetchSpy).toHaveBeenCalledTimes(1); // still cached

    // Advance another 100s — now past the 30s buffer on 3600s
    vi.advanceTimersByTime(100_000);
    fetchSpy.mockResolvedValue(makeTokenResponse("refreshed-token"));
    const third = await manager.getToken();
    expect(third).toBe("refreshed-token");
    expect(fetchSpy).toHaveBeenCalledTimes(2); // refreshed
  });

  it("clears cache on clearCache() and fetches fresh next time (AC 9)", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeTokenResponse("first-token", 3600))
      .mockResolvedValueOnce(makeTokenResponse("second-token", 3600));

    const manager = new TokenManager(oidcConfig);
    const t1 = await manager.getToken();
    expect(t1).toBe("first-token");

    manager.clearCache();
    const t2 = await manager.getToken();
    expect(t2).toBe("second-token");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("getTokenManager registry", () => {
  beforeEach(() => clearTokenManagerRegistry());
  afterEach(() => clearTokenManagerRegistry());

  it("returns the same TokenManager instance for the same engine name", () => {
    const m1 = getTokenManager("engine-a", oidcConfig);
    const m2 = getTokenManager("engine-a", oidcConfig);
    expect(m1).toBe(m2);
  });

  it("returns different instances for different engine names", () => {
    const m1 = getTokenManager("engine-a", oidcConfig);
    const m2 = getTokenManager("engine-b", oidcConfig);
    expect(m1).not.toBe(m2);
  });

  it("clearTokenManagerRegistry resets all instances", () => {
    const m1 = getTokenManager("engine-a", oidcConfig);
    clearTokenManagerRegistry();
    const m2 = getTokenManager("engine-a", oidcConfig);
    expect(m1).not.toBe(m2);
  });
});
