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

// Integration tests for multi-engine config (AC 3 of Story 10.4)
// All HTTP is intercepted by msw — no real network required.

import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { clearTokenManagerRegistry } from "../../../src/auth/token-manager.js";
import { createOperatonClient } from "../../../src/http/client.js";
import type { ResolvedConfig } from "../../../src/config.js";
import { resetCapturedState } from "../helpers/mock-operaton-server.js";

const server = setupServer();

const multiEngineConfig: ResolvedConfig = {
  engines: {
    dev: {
      url: "http://dev.example.com/engine-rest",
      authentication: { type: "basic", username: "devuser", password: "devpass" },
    },
    prod: {
      url: "http://prod.example.com/engine-rest",
      default: true,
      authentication: { type: "basic", username: "produser", password: "prodpass" },
    },
  },
  defaultEngine: "prod",
  skipHealthCheck: true,
};

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  resetCapturedState();
  clearTokenManagerRegistry();
});
afterAll(() => server.close());

describe("multi-engine routing (AC 3)", () => {
  it("uses default engine URL for calls without explicit engine name", async () => {
    let capturedUrl: string | null = null;

    server.use(
      http.get("http*", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const client = createOperatonClient(multiEngineConfig); // no explicit engine
    await client.get("/engine/prod/process-definition");

    expect(capturedUrl).toContain("http://prod.example.com/engine-rest");
    expect(capturedUrl).not.toContain("dev.example.com");
  });

  it("routes to non-default engine when explicitly specified by name", async () => {
    let capturedUrl: string | null = null;

    server.use(
      http.get("http*", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    // Create client explicitly for the 'dev' engine
    const client = createOperatonClient(multiEngineConfig, "dev");
    await client.get("/engine/dev/process-definition");

    expect(capturedUrl).toContain("http://dev.example.com/engine-rest");
    expect(capturedUrl).not.toContain("prod.example.com");
  });

  it("uses different credentials for dev vs prod engines", async () => {
    const capturedHeaders: Record<string, string[]> = { dev: [], prod: [] };

    server.use(
      http.get("http://dev.example.com*", ({ request }) => {
        const auth = request.headers.get("Authorization");
        if (auth) capturedHeaders["dev"]!.push(auth);
        return HttpResponse.json([]);
      }),
      http.get("http://prod.example.com*", ({ request }) => {
        const auth = request.headers.get("Authorization");
        if (auth) capturedHeaders["prod"]!.push(auth);
        return HttpResponse.json([]);
      }),
    );

    const devClient = createOperatonClient(multiEngineConfig, "dev");
    const prodClient = createOperatonClient(multiEngineConfig, "prod");

    await devClient.get("/engine/dev/process-definition");
    await prodClient.get("/engine/prod/process-definition");

    const expectedDev = "Basic " + Buffer.from("devuser:devpass").toString("base64");
    const expectedProd = "Basic " + Buffer.from("produser:prodpass").toString("base64");

    expect(capturedHeaders["dev"]![0]).toBe(expectedDev);
    expect(capturedHeaders["prod"]![0]).toBe(expectedProd);
  });
});
