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
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ─── Path B: Basic Auth env mode ────────────────────────────────────────────

  describe("basic auth env mode (Path B)", () => {
    it("returns ResolvedConfig with basic auth when all required env vars are set", () => {
      process.env["OPERATON_BASE_URL"] = "http://localhost:8080/engine-rest";
      process.env["OPERATON_USERNAME"] = "admin";
      process.env["OPERATON_PASSWORD"] = "admin";
      process.env["OPERATON_ENGINE"] = "my-engine";
      delete process.env["OPERATON_SKIP_HEALTH_CHECK"];
      delete process.env["OPERATON_CONFIG"];
      delete process.env["OPERATON_CLIENT_ID"];

      const config = loadConfig();

      expect(config.defaultEngine).toBe("my-engine");
      expect(config.skipHealthCheck).toBe(false);
      const engine = config.engines["my-engine"]!;
      expect(engine.url).toBe("http://localhost:8080/engine-rest");
      expect(engine.authentication.type).toBe("basic");
      if (engine.authentication.type === "basic") {
        expect(engine.authentication.username).toBe("admin");
        expect(engine.authentication.password).toBe("admin");
      }
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("defaults engineName to 'default' when OPERATON_ENGINE is unset", () => {
      process.env["OPERATON_BASE_URL"] = "http://localhost:8080/engine-rest";
      process.env["OPERATON_USERNAME"] = "admin";
      process.env["OPERATON_PASSWORD"] = "admin";
      delete process.env["OPERATON_ENGINE"];
      delete process.env["OPERATON_CONFIG"];
      delete process.env["OPERATON_CLIENT_ID"];

      const config = loadConfig();
      expect(config.defaultEngine).toBe("default");
      expect(config.engines["default"]).toBeDefined();
    });

    it("sets skipHealthCheck=true when OPERATON_SKIP_HEALTH_CHECK=true", () => {
      process.env["OPERATON_BASE_URL"] = "http://localhost:8080/engine-rest";
      process.env["OPERATON_USERNAME"] = "admin";
      process.env["OPERATON_PASSWORD"] = "admin";
      process.env["OPERATON_SKIP_HEALTH_CHECK"] = "true";
      delete process.env["OPERATON_CONFIG"];
      delete process.env["OPERATON_CLIENT_ID"];

      const config = loadConfig();
      expect(config.skipHealthCheck).toBe(true);
    });

    it("exits with error when OPERATON_BASE_URL is missing (Path B)", () => {
      delete process.env["OPERATON_BASE_URL"];
      process.env["OPERATON_USERNAME"] = "admin";
      process.env["OPERATON_PASSWORD"] = "admin";
      delete process.env["OPERATON_CONFIG"];
      delete process.env["OPERATON_CLIENT_ID"];

      expect(() => loadConfig()).toThrow("process.exit called");
      expect(errorSpy).toHaveBeenCalledWith(
        "[operaton-mcp] Missing required environment variables: OPERATON_BASE_URL",
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("exits with error when OPERATON_PASSWORD is missing", () => {
      process.env["OPERATON_BASE_URL"] = "http://localhost:8080/engine-rest";
      process.env["OPERATON_USERNAME"] = "admin";
      delete process.env["OPERATON_PASSWORD"];
      delete process.env["OPERATON_CONFIG"];
      delete process.env["OPERATON_CLIENT_ID"];

      expect(() => loadConfig()).toThrow("process.exit called");
      expect(errorSpy).toHaveBeenCalledWith(
        "[operaton-mcp] Missing required environment variables: OPERATON_PASSWORD",
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ─── Path C: OIDC env mode ──────────────────────────────────────────────────

  describe("OIDC env mode (Path C)", () => {
    it("returns ResolvedConfig with OIDC auth when all OIDC env vars are set", () => {
      process.env["OPERATON_BASE_URL"] = "http://localhost:8080/engine-rest";
      process.env["OPERATON_CLIENT_ID"] = "my-client";
      process.env["OPERATON_CLIENT_SECRET"] = "my-secret";
      process.env["OPERATON_TOKEN_URL"] =
        "https://auth.example.com/token";
      delete process.env["OPERATON_USERNAME"];
      delete process.env["OPERATON_CONFIG"];

      const config = loadConfig();

      expect(config.defaultEngine).toBe("default");
      const engine = config.engines["default"]!;
      expect(engine.url).toBe("http://localhost:8080/engine-rest");
      expect(engine.authentication.type).toBe("oidc");
      if (engine.authentication.type === "oidc") {
        expect(engine.authentication.clientId).toBe("my-client");
        expect(engine.authentication.clientSecret).toBe("my-secret");
        expect(engine.authentication.tokenUrl).toBe(
          "https://auth.example.com/token",
        );
      }
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("exits with error when OPERATON_BASE_URL is missing (Path C)", () => {
      delete process.env["OPERATON_BASE_URL"];
      process.env["OPERATON_CLIENT_ID"] = "my-client";
      process.env["OPERATON_CLIENT_SECRET"] = "my-secret";
      process.env["OPERATON_TOKEN_URL"] = "https://auth.example.com/token";
      delete process.env["OPERATON_USERNAME"];
      delete process.env["OPERATON_CONFIG"];

      expect(() => loadConfig()).toThrow("process.exit called");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("OPERATON_BASE_URL"),
      );
    });
  });

  // ─── Ambiguity guard ────────────────────────────────────────────────────────

  describe("ambiguity guard (AC 10)", () => {
    it("exits with ambiguity error when both OPERATON_USERNAME and OPERATON_CLIENT_ID are set", () => {
      process.env["OPERATON_BASE_URL"] = "http://localhost:8080/engine-rest";
      process.env["OPERATON_USERNAME"] = "admin";
      process.env["OPERATON_CLIENT_ID"] = "my-client";
      delete process.env["OPERATON_CONFIG"];

      expect(() => loadConfig()).toThrow("process.exit called");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Ambiguous authentication config"),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("OPERATON_USERNAME (basic)"),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("OPERATON_CLIENT_ID (oidc)"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ─── No configuration guard ─────────────────────────────────────────────────

  describe("no configuration guard (AC 11)", () => {
    it("exits with no-configuration error when no config, username, or clientId is set", () => {
      delete process.env["OPERATON_BASE_URL"];
      delete process.env["OPERATON_USERNAME"];
      delete process.env["OPERATON_PASSWORD"];
      delete process.env["OPERATON_CLIENT_ID"];
      delete process.env["OPERATON_CONFIG"];

      expect(() => loadConfig()).toThrow("process.exit called");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("No configuration found"),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Basic Auth"),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("OIDC"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ─── Path A: Config file mode ────────────────────────────────────────────────

  describe("config file mode (Path A)", () => {
    let tmpFile: string;

    afterEach(() => {
      try {
        unlinkSync(tmpFile);
      } catch {
        // ignore
      }
    });

    function writeTmpConfig(content: object): string {
      tmpFile = join(tmpdir(), `operaton-mcp-test-${Date.now()}.json`);
      writeFileSync(tmpFile, JSON.stringify(content), "utf-8");
      return tmpFile;
    }

    it("loads single basic auth engine from config file", () => {
      const path = writeTmpConfig({
        engines: {
          dev: {
            url: "http://localhost:8080/engine-rest",
            authentication: {
              type: "basic",
              username: "demo",
              password: "demo",
            },
          },
        },
      });
      process.env["OPERATON_CONFIG"] = path;
      delete process.env["OPERATON_USERNAME"];
      delete process.env["OPERATON_CLIENT_ID"];

      const config = loadConfig();

      expect(config.defaultEngine).toBe("dev");
      const engine = config.engines["dev"]!;
      expect(engine.authentication.type).toBe("basic");
      if (engine.authentication.type === "basic") {
        expect(engine.authentication.username).toBe("demo");
      }
    });

    it("loads single OIDC engine from config file", () => {
      const path = writeTmpConfig({
        engines: {
          prod: {
            url: "https://operaton.example.com/engine-rest",
            authentication: {
              type: "oidc",
              clientId: "mcp-client",
              clientSecret: "secret",
              tokenUrl: "https://keycloak.example.com/token",
            },
          },
        },
      });
      process.env["OPERATON_CONFIG"] = path;
      delete process.env["OPERATON_USERNAME"];
      delete process.env["OPERATON_CLIENT_ID"];

      const config = loadConfig();

      expect(config.defaultEngine).toBe("prod");
      const engine = config.engines["prod"]!;
      expect(engine.authentication.type).toBe("oidc");
      if (engine.authentication.type === "oidc") {
        expect(engine.authentication.clientId).toBe("mcp-client");
      }
    });

    it("resolves default engine when two engines and one has default:true", () => {
      const path = writeTmpConfig({
        engines: {
          dev: {
            url: "http://localhost:8080/engine-rest",
            authentication: { type: "basic", username: "demo", password: "demo" },
          },
          prod: {
            url: "https://operaton.example.com/engine-rest",
            default: true,
            authentication: { type: "basic", username: "prod", password: "prod" },
          },
        },
      });
      process.env["OPERATON_CONFIG"] = path;
      delete process.env["OPERATON_USERNAME"];
      delete process.env["OPERATON_CLIENT_ID"];

      const config = loadConfig();

      expect(config.defaultEngine).toBe("prod");
    });

    it("exits with error when two engines and none has default:true (AC 4)", () => {
      const path = writeTmpConfig({
        engines: {
          dev: {
            url: "http://localhost:8080/engine-rest",
            authentication: { type: "basic", username: "demo", password: "demo" },
          },
          prod: {
            url: "https://operaton.example.com/engine-rest",
            authentication: { type: "basic", username: "prod", password: "prod" },
          },
        },
      });
      process.env["OPERATON_CONFIG"] = path;
      delete process.env["OPERATON_USERNAME"];
      delete process.env["OPERATON_CLIENT_ID"];

      expect(() => loadConfig()).toThrow("process.exit called");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Multiple engines configured but none marked as default",
        ),
      );
    });

    it("exits with error when two engines both have default:true (AC 5)", () => {
      const path = writeTmpConfig({
        engines: {
          dev: {
            url: "http://localhost:8080/engine-rest",
            default: true,
            authentication: { type: "basic", username: "demo", password: "demo" },
          },
          prod: {
            url: "https://operaton.example.com/engine-rest",
            default: true,
            authentication: { type: "basic", username: "prod", password: "prod" },
          },
        },
      });
      process.env["OPERATON_CONFIG"] = path;
      delete process.env["OPERATON_USERNAME"];
      delete process.env["OPERATON_CLIENT_ID"];

      expect(() => loadConfig()).toThrow("process.exit called");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Multiple engines marked as default"),
      );
    });

    it("exits with file-not-found error when config file does not exist (AC 8)", () => {
      process.env["OPERATON_CONFIG"] = "/nonexistent/path/config.json";
      delete process.env["OPERATON_USERNAME"];
      delete process.env["OPERATON_CLIENT_ID"];

      expect(() => loadConfig()).toThrow("process.exit called");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Config file not found"),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("/nonexistent/path/config.json"),
      );
    });

    it("exits with parse error when config file has invalid JSON (AC 9)", () => {
      tmpFile = join(tmpdir(), `operaton-mcp-test-${Date.now()}.json`);
      writeFileSync(tmpFile, "{ not valid json ", "utf-8");
      process.env["OPERATON_CONFIG"] = tmpFile;
      delete process.env["OPERATON_USERNAME"];
      delete process.env["OPERATON_CLIENT_ID"];

      expect(() => loadConfig()).toThrow("process.exit called");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse config file"),
      );
    });
  });
});
