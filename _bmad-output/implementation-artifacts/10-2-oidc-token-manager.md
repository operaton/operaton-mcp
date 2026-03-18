# Story 10.2: OIDC Token Manager

Status: ready-for-dev

## Story

As an engineer using operaton-mcp with an OIDC-secured Operaton instance,
I want the server to automatically obtain and refresh bearer tokens using client credentials,
so that API calls are authenticated transparently without manual token management.

## Acceptance Criteria

1. **Given** an OIDC engine config **When** the first API call is made **Then** the TokenManager fetches a token from `tokenUrl` using client credentials grant (`grant_type=client_credentials`) and returns it as a bearer token string.

2. **Given** a cached token with more than 30 seconds remaining **When** a bearer token is requested **Then** the cached token is returned without a new HTTP request.

3. **Given** a cached token with 30 seconds or fewer remaining **When** a bearer token is requested **Then** a new token is fetched proactively before returning.

4. **Given** two concurrent requests arrive when no token is cached **When** both call `getToken()` simultaneously **Then** only one fetch request is made; both callers receive the same token (no thundering herd).

5. **Given** the token endpoint returns a non-2xx response **When** `getToken()` is called **Then** it throws an error with the message `[operaton-mcp] OIDC token fetch failed: HTTP {status} from {tokenUrl}`.

6. **Given** the token endpoint is unreachable (network error) **When** `getToken()` is called **Then** it throws an error with the message `[operaton-mcp] OIDC token fetch failed: {error message}`.

7. **Given** the token response contains `expires_in` **When** the token is cached **Then** expiry is calculated as `Date.now() + (expires_in * 1000)`.

8. **Given** the token response does not contain `expires_in` **When** the token is cached **Then** expiry defaults to 3600 seconds (1 hour) from now.

9. **Given** a TokenManager instance **When** `clearCache()` is called **Then** the cached token is discarded and the next `getToken()` call fetches fresh.

## Tasks / Subtasks

- [ ] Create `src/auth/token-manager.ts` (AC: 1, 2, 3, 7, 8)
  - [ ] Export `TokenManager` class
  - [ ] Constructor: `constructor(private config: OidcAuthConfig)` — receives config, no global state
  - [ ] Private fields: `cachedToken: string | null`, `expiresAt: number | null`, `inflightRequest: Promise<string> | null`
  - [ ] `async getToken(): Promise<string>` — main public method
  - [ ] Cache check: return cached token if `Date.now() < expiresAt - 30_000`
  - [ ] If no valid cache, fetch new token
  - [ ] Store `access_token` and compute `expiresAt` from `expires_in` (default 3600s)
  - [ ] `clearCache(): void` — reset cache fields (for testing)
- [ ] Implement concurrent request deduplication (AC: 4)
  - [ ] If `inflightRequest` is not null, return the existing promise
  - [ ] Set `inflightRequest` before fetch, clear it in `finally` block
- [ ] Implement token fetch via `fetch()` (AC: 1, 5, 6)
  - [ ] POST to `config.tokenUrl` with `Content-Type: application/x-www-form-urlencoded`
  - [ ] Body: `grant_type=client_credentials&client_id={clientId}&client_secret={clientSecret}`
  - [ ] Non-2xx: throw with `[operaton-mcp] OIDC token fetch failed: HTTP {status} from {tokenUrl}`
  - [ ] Network error: catch and rethrow with `[operaton-mcp] OIDC token fetch failed: {error.message}`
- [ ] Export registry functions (module-level singleton map of engine name → TokenManager)
  - [ ] `getTokenManager(engineName: string, config: OidcAuthConfig): TokenManager` — returns existing or creates new instance
  - [ ] `clearTokenManagerRegistry(): void` — resets all instances (test isolation only)
  - [ ] Initialized once per engine on first OIDC call
- [ ] Write unit tests for TokenManager (AC: 1–9)
  - [ ] Mock `fetch` using `vi.stubGlobal('fetch', ...)`
  - [ ] Test: cold cache → fetches token, caches with correct expiry
  - [ ] Test: warm cache → returns cached, no fetch called
  - [ ] Test: near-expiry cache (< 30s) → fetches new token
  - [ ] Test: concurrent calls → only one fetch, both callers get same token
  - [ ] Test: non-2xx response → throws with correct message
  - [ ] Test: network error → throws with correct message
  - [ ] Test: missing `expires_in` → defaults to 3600s expiry
  - [ ] Test: `clearCache()` → next getToken fetches fresh

## Dev Notes

### Token Manager Design

```typescript
// src/auth/token-manager.ts

import type { OidcAuthConfig } from '../config.js';

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
    if (this.cachedToken && this.expiresAt && Date.now() < this.expiresAt - 30_000) {
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
    // ... implementation
  }
}
```

### Client Credentials Grant

The token endpoint receives a standard OAuth2 client credentials request:

```
POST {tokenUrl}
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id={clientId}&client_secret={clientSecret}
```

Response contains `access_token` and optionally `expires_in` (seconds).

### Registry Pattern

The `TokenManagerRegistry` ensures one `TokenManager` instance per engine name, so token caches are shared across all tool calls to the same engine:

```typescript
// src/auth/token-manager.ts (continued)

const registry = new Map<string, TokenManager>();

export function getTokenManager(engineName: string, config: OidcAuthConfig): TokenManager {
  if (!registry.has(engineName)) {
    registry.set(engineName, new TokenManager(config));
  }
  return registry.get(engineName)!;
}

// For test isolation only:
export function clearTokenManagerRegistry(): void {
  registry.clear();
}
```

### No Global State Leaking

- `TokenManager` itself is a pure class — no module-level state
- The registry is module-level (effectively a singleton per process) — acceptable for a server process
- `clearTokenManagerRegistry()` exported for test isolation

### Key File Locations

- `src/auth/token-manager.ts` — new file
- `test/unit/auth/token-manager.test.ts` — new test file

### References

- Config types from Story 10.1: `OidcAuthConfig` interface in `src/config.ts`
- Used by Story 10.3: `src/http/client.ts` calls `getTokenManager()` for OIDC engines
