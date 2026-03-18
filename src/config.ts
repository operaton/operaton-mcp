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

import { readFileSync } from "fs";

export interface BasicAuthConfig {
  type: "basic";
  username: string;
  password: string;
}

export interface OidcAuthConfig {
  type: "oidc";
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
}

export type AuthConfig = BasicAuthConfig | OidcAuthConfig;

export interface EngineConfig {
  url: string;
  default?: boolean;
  authentication: AuthConfig;
}

interface MultiEngineFileConfig {
  engines: Record<string, EngineConfig>;
}

export interface ResolvedConfig {
  engines: Record<string, EngineConfig>;
  defaultEngine: string;
  skipHealthCheck: boolean;
}

export function loadConfig(): ResolvedConfig {
  const configPath = process.env["OPERATON_CONFIG"];
  const username = process.env["OPERATON_USERNAME"];
  const clientId = process.env["OPERATON_CLIENT_ID"];
  const skipHealthCheck =
    process.env["OPERATON_SKIP_HEALTH_CHECK"]?.toLowerCase() === "true";

  // Path A: OPERATON_CONFIG is set — file-based multi-engine config
  if (configPath) {
    let raw: string;
    try {
      raw = readFileSync(configPath, "utf-8");
    } catch {
      console.error(`[operaton-mcp] Error: Config file not found: ${configPath}`);
      process.exit(1);
    }

    let fileConfig: MultiEngineFileConfig;
    try {
      fileConfig = JSON.parse(raw) as MultiEngineFileConfig;
    } catch (e) {
      console.error(
        `[operaton-mcp] Error: Failed to parse config file: ${(e as Error).message}`,
      );
      process.exit(1);
    }

    const engines = fileConfig.engines;
    const engineKeys = Object.keys(engines);
    const defaultKeys = engineKeys.filter((k) => engines[k]!.default);

    let defaultEngine: string;
    if (engineKeys.length === 1) {
      defaultEngine = engineKeys[0]!;
    } else if (defaultKeys.length === 1) {
      defaultEngine = defaultKeys[0]!;
    } else if (defaultKeys.length === 0) {
      console.error(
        `[operaton-mcp] Error: Multiple engines configured but none marked as default. Set "default": true on exactly one engine.`,
      );
      process.exit(1);
    } else {
      console.error(
        `[operaton-mcp] Error: Multiple engines marked as default. Exactly one engine must have "default": true.`,
      );
      process.exit(1);
    }

    return { engines, defaultEngine, skipHealthCheck };
  }

  // Ambiguity guard: both USERNAME and CLIENT_ID set
  if (username && clientId) {
    console.error(
      `[operaton-mcp] Error: Ambiguous authentication config: both OPERATON_USERNAME (basic) and OPERATON_CLIENT_ID (oidc) are set. Use only one auth mode, or use OPERATON_CONFIG for multi-engine setups.`,
    );
    process.exit(1);
  }

  const engineKey = process.env["OPERATON_ENGINE"] ?? "default";

  // Path B: Basic auth env mode (OPERATON_USERNAME is set)
  if (username) {
    const baseUrl = process.env["OPERATON_BASE_URL"];
    const password = process.env["OPERATON_PASSWORD"];
    const missing: string[] = [];
    if (!baseUrl) missing.push("OPERATON_BASE_URL");
    if (!password) missing.push("OPERATON_PASSWORD");
    if (missing.length > 0) {
      console.error(
        `[operaton-mcp] Missing required environment variables: ${missing.join(", ")}`,
      );
      process.exit(1);
    }

    return {
      engines: {
        [engineKey]: {
          url: baseUrl!,
          default: true,
          authentication: { type: "basic", username, password: password! },
        },
      },
      defaultEngine: engineKey,
      skipHealthCheck,
    };
  }

  // Path C: OIDC env mode (OPERATON_CLIENT_ID is set)
  if (clientId) {
    const baseUrl = process.env["OPERATON_BASE_URL"];
    const clientSecret = process.env["OPERATON_CLIENT_SECRET"];
    const tokenUrl = process.env["OPERATON_TOKEN_URL"];
    const missing: string[] = [];
    if (!baseUrl) missing.push("OPERATON_BASE_URL");
    if (!clientSecret) missing.push("OPERATON_CLIENT_SECRET");
    if (!tokenUrl) missing.push("OPERATON_TOKEN_URL");
    if (missing.length > 0) {
      console.error(
        `[operaton-mcp] Missing required environment variables: ${missing.join(", ")}`,
      );
      process.exit(1);
    }

    return {
      engines: {
        [engineKey]: {
          url: baseUrl!,
          default: true,
          authentication: {
            type: "oidc",
            clientId,
            clientSecret: clientSecret!,
            tokenUrl: tokenUrl!,
          },
        },
      },
      defaultEngine: engineKey,
      skipHealthCheck,
    };
  }

  // No configuration found
  console.error(
    `[operaton-mcp] Error: No configuration found. Provide one of:\n  Basic Auth:  OPERATON_BASE_URL + OPERATON_USERNAME + OPERATON_PASSWORD\n  OIDC:        OPERATON_BASE_URL + OPERATON_CLIENT_ID + OPERATON_CLIENT_SECRET + OPERATON_TOKEN_URL\n  Multi-engine: OPERATON_CONFIG=/path/to/config.json`,
  );
  process.exit(1);
}
