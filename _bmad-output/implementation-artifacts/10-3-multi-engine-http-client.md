# Story 10.3: Multi-Engine HTTP Client & Connectivity

Status: ready-for-dev

## Story

As a developer using operaton-mcp,
I want the HTTP client to route requests to the correct Operaton engine using the appropriate auth strategy (Basic or Bearer),
so that all tool calls are authenticated correctly without any per-tool changes.

## Acceptance Criteria

1. **Given** an engine with `authentication.type === 'basic'` **When** any HTTP request is made **Then** the request includes `Authorization: Basic {base64(username:password)}` header.

2. **Given** an engine with `authentication.type === 'oidc'` **When** any HTTP request is made **Then** `getToken()` is called for that engine and the request includes `Authorization: Bearer {token}` header.

3. **Given** a `ResolvedConfig` with multiple engines **When** `createOperatonClient()` is called with no engine name **Then** the client uses the `defaultEngine`.

4. **Given** the OIDC token fetch fails **When** an HTTP request is attempted **Then** the error propagates as a structured MCP error: `OIDC authentication failed: {reason}`.

5. **Given** the connectivity check runs at startup **When** the default engine uses OIDC auth **Then** the connectivity check fetches a token and uses it for the `GET /engine` health check request.

6. **Given** `OPERATON_SKIP_HEALTH_CHECK=true` **When** the server starts **Then** the connectivity check is skipped for all engines (existing behavior preserved).

7. **Given** `createOperatonClient()` is called **When** any request is made **Then** the base URL is taken from the selected engine's `url` field (not from a global env var).

## Tasks / Subtasks

- [ ] Update `src/http/client.ts` to use `ResolvedConfig` and `EngineConfig` (AC: 1, 2, 3, 7)
  - [ ] Update `createOperatonClient(config: ResolvedConfig, engineName?: string): OperatonClient`
    - [ ] Resolve engine: use `engineName` if provided, else `config.defaultEngine`
    - [ ] Build auth header based on `engineConfig.authentication.type`
    - [ ] For `'basic'`: `Authorization: Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` — use `Buffer.from`, NOT `btoa` (browser-only API)
    - [ ] For `'oidc'`: await `getTokenManager(engineName, oidcConfig).getToken()` then `Authorization: Bearer {token}`
    - [ ] Use `engineConfig.url` as the base URL
  - [ ] Update `checkConnectivity(config: ResolvedConfig): Promise<void>`
    - [ ] Check default engine only
    - [ ] Resolve auth header using same logic as request handler
    - [ ] On failure log `[operaton-mcp] Warning: Cannot reach Operaton at {url}. ...` (preserve existing format)
- [ ] Handle OIDC token errors in request path (AC: 4)
  - [ ] Catch token fetch errors and rethrow as structured MCP errors
  - [ ] Error format: `{ type: 'auth_error', cause: 'OIDC authentication failed: {reason}' }`
- [ ] Update `src/index.ts` — no logic change, but verify types compile after config interface change
- [ ] Update all generated tool files that call `createOperatonClient` to pass `ResolvedConfig` (AC: 7)
  - [ ] Search for all `createOperatonClient(config)` call sites in `src/tools/`
  - [ ] Verify no tool file reads auth fields directly — all must go through client factory
  - [ ] **Validate with `tsc --noEmit` before manually editing any tool files** — if `ResolvedConfig` is a clean drop-in for `Config`, the compiler will confirm zero changes needed in generated tools
- [ ] Write unit tests (AC: 1–7)
  - [ ] Test: basic auth engine → correct `Authorization: Basic` header on request
  - [ ] Test: OIDC auth engine → calls TokenManager.getToken(), correct `Authorization: Bearer` header
  - [ ] Test: no engineName → uses defaultEngine
  - [ ] Test: OIDC token failure → propagates as structured MCP error
  - [ ] Test: checkConnectivity with OIDC engine → fetches token for health check
  - [ ] Test: checkConnectivity skipped when skipHealthCheck=true (existing test preserved)

## Dev Notes

### Updated Client Factory Signature

```typescript
// src/http/client.ts

import { getTokenManager } from '../auth/token-manager.js';
import type { ResolvedConfig, EngineConfig } from '../config.js';

export function createOperatonClient(
  config: ResolvedConfig,
  engineName?: string
): OperatonClient {
  const resolvedEngineName = engineName ?? config.defaultEngine;
  const engine = config.engines[resolvedEngineName];
  if (!engine) {
    throw new Error(`[operaton-mcp] Unknown engine: "${resolvedEngineName}"`);
  }
  return new OperatonClient(engine);
}
```

### Auth Header Resolution

```typescript
async function buildAuthHeader(engineName: string, engine: EngineConfig): Promise<string> {
  if (engine.authentication.type === 'basic') {
    const { username, password } = engine.authentication;
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  } else {
    const token = await getTokenManager(engineName, engine.authentication).getToken();
    return `Bearer ${token}`;
  }
}
```

### Important: No Breaking Change to Tool Signatures

Generated tools in `src/tools/` call `createOperatonClient(config)`. The function signature change (`ResolvedConfig` replacing `Config`) must remain call-site compatible — `ResolvedConfig` is a superset replacement. Verify via TypeScript compilation; do not manually edit tool files unless types break.

### Connectivity Check Update

```typescript
export async function checkConnectivity(config: ResolvedConfig): Promise<void> {
  if (config.skipHealthCheck) return;
  const engine = config.engines[config.defaultEngine];
  const url = `${engine.url}/engine`;
  try {
    const authHeader = await buildAuthHeader(config.defaultEngine, engine);
    const response = await fetch(url, { headers: { Authorization: authHeader } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (err) {
    console.error(`[operaton-mcp] Warning: Cannot reach Operaton at ${engine.url}. Verify connectivity.`);
  }
}
```

### Key File Locations

- `src/http/client.ts` — update existing factory and connectivity check
- `src/auth/token-manager.ts` — imported (from Story 10.2)
- `src/config.ts` — import `ResolvedConfig`, `EngineConfig` types (from Story 10.1)
- `src/tools/**` — verify types compile; no manual edits expected

### References

- Story 10.1: `ResolvedConfig`, `EngineConfig`, `AuthConfig` types
- Story 10.2: `getTokenManager()` function
- Existing story: `_bmad-output/implementation-artifacts/1-3-http-client-factory-and-error-normalization.md`
