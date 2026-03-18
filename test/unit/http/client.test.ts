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
  checkConnectivity,
  createOperatonClient,
} from "../../../src/http/client.js";
import {
  clearTokenManagerRegistry,
  getTokenManager,
} from "../../../src/auth/token-manager.js";
import type { ResolvedConfig } from "../../../src/config.js";

const basicConfig: ResolvedConfig = {
  engines: {
    default: {
      url: "http://localhost:8080/engine-rest",
      authentication: { type: "basic", username: "admin", password: "admin" },
    },
  },
  defaultEngine: "default",
  skipHealthCheck: false,
};

const oidcConfig: ResolvedConfig = {
  engines: {
    default: {
      url: "http://localhost:8080/engine-rest",
      authentication: {
        type: "oidc",
        clientId: "mcp-client",
        clientSecret: "secret",
        tokenUrl: "https://auth.example.com/token",
      },
    },
  },
  defaultEngine: "default",
  skipHealthCheck: false,
};

describe("createOperatonClient — basic auth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearTokenManagerRegistry();
  });

  it("injects correct Authorization: Basic header (AC 1)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "123" }), { status: 200 }),
    );

    const client = createOperatonClient(basicConfig);
    await client.get("/engine/{engineName}/process-definition");

    const call = fetchSpy.mock.calls[0];
    expect(call).toBeDefined();
    const options = call![1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    const expectedAuth =
      "Basic " + Buffer.from("admin:admin").toString("base64");
    expect(headers["Authorization"]).toBe(expectedAuth);
  });

  it("resolves {engineName} placeholder in path", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    const config: ResolvedConfig = {
      engines: {
        "my-engine": {
          url: "http://localhost:8080/engine-rest",
          authentication: {
            type: "basic",
            username: "admin",
            password: "admin",
          },
        },
      },
      defaultEngine: "my-engine",
      skipHealthCheck: false,
    };
    const client = createOperatonClient(config);
    await client.get("/engine/{engineName}/process-definition");

    const call = fetchSpy.mock.calls[0];
    const url = call![0] as string;
    expect(url).toContain("/engine/my-engine/process-definition");
    expect(url).not.toContain("{engineName}");
  });

  it("returns parsed JSON on successful response", async () => {
    const payload = [{ id: "abc", name: "My Process" }];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );

    const client = createOperatonClient(basicConfig);
    const result = await client.get("/engine/{engineName}/process-definition");

    expect(result).toEqual(payload);
  });

  it("returns null for successful 204 responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    const client = createOperatonClient(basicConfig);
    const result = await client.delete("/engine/{engineName}/user/test-user");

    expect(result).toBeNull();
  });

  it("returns normalized McpToolError on 4xx response", async () => {
    const errorBody = {
      type: "NotFoundException",
      message: "Process definition not found",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(errorBody), { status: 404 }),
    );

    const client = createOperatonClient(basicConfig);
    const result = (await client.get(
      "/engine/{engineName}/process-definition/nonexistent",
    )) as { isError: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[NotFoundException]");
    expect(result.content[0]?.text).toContain("Suggested action:");
  });

  it("uses default engine when no engineName provided (AC 3)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    const config: ResolvedConfig = {
      engines: {
        main: {
          url: "http://main.example.com/engine-rest",
          authentication: {
            type: "basic",
            username: "admin",
            password: "admin",
          },
        },
      },
      defaultEngine: "main",
      skipHealthCheck: false,
    };

    const client = createOperatonClient(config); // no explicit engine name
    await client.get("/engine/{engineName}/process-definition");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("http://main.example.com/engine-rest");
  });
});

describe("createOperatonClient — OIDC auth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearTokenManagerRegistry();
  });

  it("calls getToken() and injects Authorization: Bearer header (AC 2)", async () => {
    // Mock the OIDC token fetch
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "my-oidc-token", expires_in: 3600 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "123" }), { status: 200 }),
      );

    const client = createOperatonClient(oidcConfig);
    await client.get("/engine/{engineName}/process-definition");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const apiCall = fetchSpy.mock.calls[1];
    const options = apiCall![1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer my-oidc-token");
  });

  it("includes Authorization: Bearer header from token manager", async () => {
    // Pre-seed the token manager with a known token
    clearTokenManagerRegistry();
    const oidcAuth = oidcConfig.engines["default"]!.authentication;
    if (oidcAuth.type !== "oidc") throw new Error("expected oidc");

    const manager = getTokenManager("default", oidcAuth);
    // Stub getToken on the manager
    vi.spyOn(manager, "getToken").mockResolvedValue("pre-seeded-token");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const client = createOperatonClient(oidcConfig);
    await client.get("/engine/{engineName}/process-definition");

    const call = fetchSpy.mock.calls[0];
    const options = call![1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer pre-seeded-token");
  });

  it("returns OIDC token failure as structured auth error (AC 4)", async () => {
    clearTokenManagerRegistry();
    const oidcAuth = oidcConfig.engines["default"]!.authentication;
    if (oidcAuth.type !== "oidc") throw new Error("expected oidc");

    const manager = getTokenManager("default", oidcAuth);
    vi.spyOn(manager, "getToken").mockRejectedValue(
      new Error("[operaton-mcp] OIDC token fetch failed: HTTP 401"),
    );

    const client = createOperatonClient(oidcConfig);
    const result = (await client.get("/some/path")) as {
      isError: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("[auth_error]");
    expect(result.content[0]?.text).toContain("OIDC authentication failed");
  });
});

describe("checkConnectivity", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    clearTokenManagerRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearTokenManagerRegistry();
  });

  it("skips check when skipHealthCheck is true (AC 6)", async () => {
    const config: ResolvedConfig = { ...basicConfig, skipHealthCheck: true };
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await checkConnectivity(config);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs warning when fetch throws (unreachable host)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("ECONNREFUSED"),
    );

    await checkConnectivity(basicConfig);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[operaton-mcp] Warning: Cannot reach Operaton at"),
    );
  });

  it("logs warning on non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    await checkConnectivity(basicConfig);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[operaton-mcp] Warning: Cannot reach Operaton at"),
    );
  });

  it("does not log when connectivity check succeeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ name: "default" }]), { status: 200 }),
    );

    await checkConnectivity(basicConfig);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("uses OIDC token for connectivity check when engine uses OIDC (AC 5)", async () => {
    clearTokenManagerRegistry();
    const oidcAuth = oidcConfig.engines["default"]!.authentication;
    if (oidcAuth.type !== "oidc") throw new Error("expected oidc");

    const manager = getTokenManager("default", oidcAuth);
    vi.spyOn(manager, "getToken").mockResolvedValue("health-check-token");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ name: "default" }]), { status: 200 }),
    );

    await checkConnectivity(oidcConfig);

    const call = fetchSpy.mock.calls[0];
    const options = call![1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer health-check-token");
  });

  it("uses engine URL from config (not a global env var) (AC 7)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ name: "default" }]), { status: 200 }),
    );

    const config: ResolvedConfig = {
      engines: {
        default: {
          url: "http://custom-engine.example.com/engine-rest",
          authentication: {
            type: "basic",
            username: "u",
            password: "p",
          },
        },
      },
      defaultEngine: "default",
      skipHealthCheck: false,
    };

    await checkConnectivity(config);

    const call = fetchSpy.mock.calls[0];
    const url = call![0] as string;
    expect(url).toContain("http://custom-engine.example.com/engine-rest");
  });
});
