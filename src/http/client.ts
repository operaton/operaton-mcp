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

import type { ResolvedConfig, EngineConfig } from "../config.js";
import { getTokenManager } from "../auth/token-manager.js";
import { normalize } from "./errors.js";
import type { McpToolError } from "./errors.js";

export interface OperatonClient {
  get(path: string): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
  postMultipart(path: string, fields: Record<string, string>): Promise<unknown>;
  put(path: string, body?: unknown): Promise<unknown>;
  delete(path: string): Promise<unknown>;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const body = error as Record<string, unknown>;
    if (typeof body["message"] === "string") {
      return body["message"];
    }
    if (typeof body["cause"] === "string") {
      return body["cause"];
    }
  }

  try {
    return String(error);
  } catch {
    return "[Unknown error]";
  }
}

async function parseResponseBody(response: Response): Promise<unknown | null> {
  const text = await response.text();
  if (text.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function buildAuthHeader(
  engineName: string,
  engine: EngineConfig,
): Promise<string> {
  if (engine.authentication.type === "basic") {
    const { username, password } = engine.authentication;
    return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  } else {
    try {
      const token = await getTokenManager(
        engineName,
        engine.authentication,
      ).getToken();
      return `Bearer ${token}`;
    } catch (err) {
      throw {
        type: "auth_error",
        message: `OIDC authentication failed: ${extractErrorMessage(err)}`,
      };
    }
  }
}

export function createOperatonClient(
  config: ResolvedConfig,
  engineName?: string,
): OperatonClient {
  const resolvedEngineName = engineName ?? config.defaultEngine;
  const engine = config.engines[resolvedEngineName];
  if (!engine) {
    throw new Error(`[operaton-mcp] Unknown engine: "${resolvedEngineName}"`);
  }

  const baseUrl = engine.url.replace(/\/+$/, "");

  function resolvePath(path: string): string {
    return path.replace("{engineName}", resolvedEngineName);
  }

  async function request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const resolvedPath = resolvePath(path);
    const url = `${baseUrl}${resolvedPath}`;
    let authHeader: string;
    try {
      authHeader = await buildAuthHeader(resolvedEngineName, engine);
    } catch (error) {
      return normalize(error);
    }
    const headers: Record<string, string> = {
      Authorization: authHeader,
      Accept: "application/json",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const errorBody = await parseResponseBody(response);
      return normalize(errorBody) as McpToolError;
    }
    if (response.status === 204) {
      return null;
    }
    return parseResponseBody(response);
  }

  async function requestMultipart(
    path: string,
    fields: Record<string, string>,
  ): Promise<unknown> {
    const resolvedPath = resolvePath(path);
    const url = `${baseUrl}${resolvedPath}`;
    let authHeader: string;
    try {
      authHeader = await buildAuthHeader(resolvedEngineName, engine);
    } catch (error) {
      return normalize(error);
    }
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: authHeader, Accept: "application/json" },
      body: form,
    });
    if (!response.ok) {
      const errorBody = await parseResponseBody(response);
      return normalize(errorBody) as McpToolError;
    }
    if (response.status === 204) {
      return null;
    }
    return parseResponseBody(response);
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    postMultipart: (path, fields) => requestMultipart(path, fields),
    put: (path, body) => request("PUT", path, body),
    delete: (path) => request("DELETE", path),
  };
}

export async function checkConnectivity(config: ResolvedConfig): Promise<void> {
  if (config.skipHealthCheck) {
    return;
  }

  const engine = config.engines[config.defaultEngine]!;
  const url = engine.url.replace(/\/+$/, "");

  try {
    const authHeader = await buildAuthHeader(config.defaultEngine, engine);
    const response = await fetch(`${url}/engine`, {
      headers: { Authorization: authHeader },
    });
    if (!response.ok) {
      console.error(
        `[operaton-mcp] Warning: Cannot reach Operaton at ${url}. Verify connectivity.`,
      );
    }
  } catch {
    console.error(
      `[operaton-mcp] Warning: Cannot reach Operaton at ${url}. Verify connectivity.`,
    );
  }
}
