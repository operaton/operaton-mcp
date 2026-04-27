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

// ─── Guard Config ────────────────────────────────────────────────────────────

export type GuardMode = "unrestricted" | "read-only" | "safe";
export type ResourceDomain =
  | "process-definitions"
  | "deployments"
  | "instances"
  | "tasks"
  | "jobs"
  | "incidents"
  | "users-groups"
  | "decisions"
  | "migrations"
  | "infrastructure";
export type OperationClass =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "suspend-resume"
  | "deploy"
  | "migrate-execute"
  | "migrate-control";

export const VALID_GUARD_MODES: GuardMode[] = [
  "unrestricted",
  "read-only",
  "safe",
];
export const VALID_RESOURCE_DOMAINS: ResourceDomain[] = [
  "process-definitions",
  "deployments",
  "instances",
  "tasks",
  "jobs",
  "incidents",
  "users-groups",
  "decisions",
  "migrations",
  "infrastructure",
];
export const VALID_OP_CLASSES: OperationClass[] = [
  "read",
  "create",
  "update",
  "delete",
  "suspend-resume",
  "deploy",
  "migrate-execute",
  "migrate-control",
];

export interface GuardConfig {
  mode: GuardMode;
  denyResources: ResourceDomain[];
  denyOps: OperationClass[];
}

export function loadGuardConfig(): GuardConfig {
  const guardMode = process.env["OPERATON_GUARD"];
  const denyResourcesRaw = process.env["OPERATON_DENY_RESOURCES"];
  const denyOpsRaw = process.env["OPERATON_DENY_OPS"];

  let mode: GuardMode = "unrestricted";
  if (guardMode) {
    if (!VALID_GUARD_MODES.includes(guardMode as GuardMode)) {
      console.error(
        `[operaton-mcp] Invalid OPERATON_GUARD value: "${guardMode}". Valid values: unrestricted, read-only, safe`,
      );
      process.exit(1);
    }
    mode = guardMode as GuardMode;
  }

  const denyResources: ResourceDomain[] = [];
  if (denyResourcesRaw) {
    for (const entry of denyResourcesRaw.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!VALID_RESOURCE_DOMAINS.includes(entry as ResourceDomain)) {
        console.error(
          `[operaton-mcp] Invalid OPERATON_DENY_RESOURCES entry: "${entry}". Valid domains: process-definitions, deployments, instances, tasks, jobs, incidents, users-groups, decisions, migrations, infrastructure`,
        );
        process.exit(1);
      }
      denyResources.push(entry as ResourceDomain);
    }
  }

  const denyOps: OperationClass[] = [];
  if (denyOpsRaw) {
    for (const entry of denyOpsRaw.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!VALID_OP_CLASSES.includes(entry as OperationClass)) {
        console.error(
          `[operaton-mcp] Invalid OPERATON_DENY_OPS entry: "${entry}". Valid classes: read, create, update, delete, suspend-resume, deploy, migrate-execute, migrate-control`,
        );
        process.exit(1);
      }
      denyOps.push(entry as OperationClass);
    }
  }

  const isActive = !!guardMode || !!denyResourcesRaw || !!denyOpsRaw;
  if (isActive) {
    console.error(
      `[operaton-mcp] Guard: OPERATON_GUARD=${guardMode ?? ""} OPERATON_DENY_RESOURCES=${denyResourcesRaw ?? ""} OPERATON_DENY_OPS=${denyOpsRaw ?? ""}`,
    );
  }

  return { mode, denyResources, denyOps };
}

// ─── Auth Config ─────────────────────────────────────────────────────────────

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
  guard: GuardConfig;
}

export function loadConfig(): ResolvedConfig {
  const guard = loadGuardConfig();
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

    return { engines, defaultEngine, skipHealthCheck, guard };
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
      guard,
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
      guard,
    };
  }

  // No configuration found
  console.error(
    `[operaton-mcp] Error: No configuration found. Provide one of:\n  Basic Auth:  OPERATON_BASE_URL + OPERATON_USERNAME + OPERATON_PASSWORD\n  OIDC:        OPERATON_BASE_URL + OPERATON_CLIENT_ID + OPERATON_CLIENT_SECRET + OPERATON_TOKEN_URL\n  Multi-engine: OPERATON_CONFIG=/path/to/config.json`,
  );
  process.exit(1);
}
