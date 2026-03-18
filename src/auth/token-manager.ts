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

import type { OidcAuthConfig } from "../config.js";

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

export class TokenManager {
  private cachedToken: string | null = null;
  private expiresAt: number | null = null;
  private inflightRequest: Promise<string> | null = null;

  constructor(private readonly config: OidcAuthConfig) {}

  async getToken(): Promise<string> {
    if (
      this.cachedToken &&
      this.expiresAt &&
      Date.now() < this.expiresAt - 30_000
    ) {
      return this.cachedToken;
    }
    if (this.inflightRequest) {
      return this.inflightRequest;
    }
    this.inflightRequest = this.fetchToken().finally(() => {
      this.inflightRequest = null;
    });
    return this.inflightRequest;
  }

  clearCache(): void {
    this.cachedToken = null;
    this.expiresAt = null;
    this.inflightRequest = null;
  }

  private async fetchToken(): Promise<string> {
    const { clientId, clientSecret, tokenUrl } = this.config;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });

    let response: Response;
    try {
      response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
    } catch (err) {
      throw new Error(
        `[operaton-mcp] OIDC token fetch failed: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `[operaton-mcp] OIDC token fetch failed: HTTP ${response.status} from ${tokenUrl}`,
      );
    }

    const data = (await response.json()) as TokenResponse;
    const expiresIn = data.expires_in ?? 3600;
    this.cachedToken = data.access_token;
    this.expiresAt = Date.now() + expiresIn * 1000;
    return this.cachedToken;
  }
}

const registry = new Map<string, TokenManager>();

export function getTokenManager(
  engineName: string,
  config: OidcAuthConfig,
): TokenManager {
  if (!registry.has(engineName)) {
    registry.set(engineName, new TokenManager(config));
  }
  return registry.get(engineName)!;
}

export function clearTokenManagerRegistry(): void {
  registry.clear();
}
