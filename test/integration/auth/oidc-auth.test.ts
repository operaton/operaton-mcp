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

// Integration tests for OIDC auth (AC 1, 5, 6 of Story 10.4)
// All HTTP is intercepted by msw — no real network required.

import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { clearTokenManagerRegistry, TokenManager } from "../../../src/auth/token-manager.js";
import { createOperatonClient } from "../../../src/http/client.js";
import type { ResolvedConfig, OidcAuthConfig } from "../../../src/config.js";
import {
  captureAuthHeader,
  getLastAuthHeader,
  resetCapturedState,
} from "../helpers/mock-operaton-server.js";
import { createMockOidcHandler } from "../helpers/mock-oidc-server.js";

const TOKEN_URL = "https://auth.example.com/token";
const ENGINE_URL = "http://localhost:18080/engine-rest";

const oidcEngineConfig: OidcAuthConfig = {
  type: "oidc",
  clientId: "mcp-client",
  clientSecret: "test-secret",
  tokenUrl: TOKEN_URL,
};

const oidcResolvedConfig: ResolvedConfig = {
  engines: {
    default: {
      url: ENGINE_URL,
      authentication: oidcEngineConfig,
    },
  },
  defaultEngine: "default",
  skipHealthCheck: true,
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  resetCapturedState();
  clearTokenManagerRegistry();
  vi.useRealTimers();
});
afterAll(() => server.close());

describe("OIDC auth integration (AC 1)", () => {
  it("fetches token once and sends Authorization: Bearer header", async () => {
    server.use(
      createMockOidcHandler(TOKEN_URL, { token: "oidc-integration-token" }),
      captureAuthHeader,
    );

    const client = createOperatonClient(oidcResolvedConfig);
    await client.get("/engine/default/process-definition");

    expect(getLastAuthHeader()).toBe("Bearer oidc-integration-token");
  });

  it("token is fetched only once for multiple requests (caching)", async () => {
    let fetchCount = 0;
    server.use(
      http.post(TOKEN_URL, () => {
        fetchCount++;
        return HttpResponse.json({
          access_token: `token-${fetchCount}`,
          expires_in: 3600,
          token_type: "Bearer",
        });
      }),
      captureAuthHeader,
    );

    const client = createOperatonClient(oidcResolvedConfig);
    await client.get("/engine/default/process-definition");
    await client.get("/engine/default/process-definition");

    expect(fetchCount).toBe(1); // token was cached
  });
});

describe("token expiry refresh (AC 5)", () => {
  it("fetches a new token after the previous one expires", async () => {
    vi.useFakeTimers();
    let fetchCount = 0;

    server.use(
      http.post(TOKEN_URL, () => {
        fetchCount++;
        return HttpResponse.json({
          access_token: `token-${fetchCount}`,
          expires_in: 60,
          token_type: "Bearer",
        });
      }),
    );

    const manager = new TokenManager(oidcEngineConfig);

    const t1 = await manager.getToken();
    expect(t1).toBe("token-1");
    expect(fetchCount).toBe(1);

    // Advance clock past the 30s buffer (60s TTL - 30s buffer = 30s window)
    vi.advanceTimersByTime(31_000);

    const t2 = await manager.getToken();
    expect(t2).toBe("token-2");
    expect(fetchCount).toBe(2);
  });
});

describe("OIDC error handling (AC 6)", () => {
  it("propagates structured MCP auth error when token endpoint returns error", async () => {
    server.use(
      createMockOidcHandler(TOKEN_URL, { status: 401 }),
    );

    const client = createOperatonClient(oidcResolvedConfig);
    await expect(
      client.get("/engine/default/process-definition"),
    ).rejects.toMatchObject({
      type: "auth_error",
      cause: expect.stringContaining("OIDC authentication failed"),
    });
  });
});
