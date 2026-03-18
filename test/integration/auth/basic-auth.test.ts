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

// Integration tests for basic auth (AC 2, 4 of Story 10.4)
// These tests use msw to intercept HTTP calls — no real network required.

import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { clearTokenManagerRegistry } from "../../../src/auth/token-manager.js";
import { createOperatonClient } from "../../../src/http/client.js";
import type { ResolvedConfig } from "../../../src/config.js";
import {
  captureAuthHeader,
  getLastAuthHeader,
  resetCapturedState,
} from "../helpers/mock-operaton-server.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  resetCapturedState();
  clearTokenManagerRegistry();
});
afterAll(() => server.close());

describe("basic auth integration (AC 2)", () => {
  it("sends Authorization: Basic header with correct base64 credentials", async () => {
    server.use(captureAuthHeader);

    const config: ResolvedConfig = {
      engines: {
        default: {
          url: "http://localhost:18080/engine-rest",
          authentication: {
            type: "basic",
            username: "testuser",
            password: "testpass",
          },
        },
      },
      defaultEngine: "default",
      skipHealthCheck: true,
    };

    const client = createOperatonClient(config);
    await client.get("/engine/default/process-definition");

    const expectedAuth =
      "Basic " + Buffer.from("testuser:testpass").toString("base64");
    expect(getLastAuthHeader()).toBe(expectedAuth);
  });

  it("basic auth config file engine sends correct Basic header", async () => {
    server.use(captureAuthHeader);

    const config: ResolvedConfig = {
      engines: {
        "dev-engine": {
          url: "http://localhost:18080/engine-rest",
          authentication: {
            type: "basic",
            username: "dev",
            password: "devpass",
          },
        },
      },
      defaultEngine: "dev-engine",
      skipHealthCheck: true,
    };

    const client = createOperatonClient(config);
    await client.get("/engine/dev-engine/process-definition");

    const expectedAuth =
      "Basic " + Buffer.from("dev:devpass").toString("base64");
    expect(getLastAuthHeader()).toBe(expectedAuth);
  });
});

describe("legacy env-var basic auth (AC 4 — regression test)", () => {
  it("legacy basic auth config initializes and makes authenticated calls without regression", async () => {
    server.use(captureAuthHeader);

    // Simulate what loadConfig() returns for legacy env var mode:
    // OPERATON_BASE_URL + OPERATON_USERNAME + OPERATON_PASSWORD
    const config: ResolvedConfig = {
      engines: {
        default: {
          url: "http://localhost:18080/engine-rest",
          authentication: {
            type: "basic",
            username: "demo",
            password: "demo",
          },
        },
      },
      defaultEngine: "default",
      skipHealthCheck: true,
    };

    const client = createOperatonClient(config);
    await client.get("/engine/default/process-definition");

    const expectedAuth = "Basic " + Buffer.from("demo:demo").toString("base64");
    expect(getLastAuthHeader()).toBe(expectedAuth);
  });
});
