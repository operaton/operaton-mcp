# Story 10.4: Auth & Multi-Engine Integration Tests

Status: ready-for-dev

## Story

As a developer maintaining operaton-mcp,
I want automated integration tests covering all authentication modes and multi-engine config,
so that regressions in auth behavior are caught before release.

## Acceptance Criteria

1. **Given** a mock OIDC token endpoint **When** an OIDC-configured engine makes a tool call **Then** the test verifies the token was requested and the `Authorization: Bearer` header was sent to Operaton.

2. **Given** a basic-auth engine **When** a tool call is made **Then** the test verifies `Authorization: Basic` header with correct base64 credentials was sent to Operaton.

3. **Given** a multi-engine config file with two engines **When** the server starts **Then** the test verifies the default engine is used for unannotated calls and the named engine is accessible by name.

4. **Given** a legacy env-var basic-auth config (no `OPERATON_CONFIG`) **When** the server starts **Then** the test verifies the server initializes correctly and makes authenticated calls — confirming no regression for existing users.

5. **Given** an OIDC token that expires during a test session **When** the token's TTL passes and another call is made **Then** the test verifies a new token is fetched automatically.

6. **Given** a mock OIDC endpoint that returns an error **When** a tool call is attempted **Then** the test verifies a structured MCP auth error is returned (not a crash).

7. **Given** all integration tests run **When** they complete **Then** no real external services are called — all HTTP is intercepted by mock handlers.

## Tasks / Subtasks

- [ ] Set up mock HTTP infrastructure for tests (AC: 7)
  - [ ] Add `msw` (Mock Service Worker) or `nock` as a dev dependency for HTTP interception
  - [ ] Create `test/integration/helpers/mock-oidc-server.ts` — mock token endpoint handler
    - [ ] Responds to POST with `{ access_token: 'test-token', expires_in: 3600 }`
    - [ ] Configurable: can return error status, custom TTL, specific token value
  - [ ] Create `test/integration/helpers/mock-operaton-server.ts` — mock Operaton endpoint handler
    - [ ] Records received request headers for assertion
    - [ ] Returns minimal valid Operaton REST responses
- [ ] Write integration test: basic auth (AC: 2, 4)
  - [ ] File: `test/integration/auth/basic-auth.test.ts`
  - [ ] Test: legacy env vars → `Authorization: Basic` header on requests
  - [ ] Test: config file basic engine → `Authorization: Basic` header on requests
- [ ] Write integration test: OIDC auth (AC: 1, 5, 6)
  - [ ] File: `test/integration/auth/oidc-auth.test.ts`
  - [ ] Test: OIDC engine → token fetched once, `Authorization: Bearer` header sent
  - [ ] Test: token expiry → use `vi.useFakeTimers()` to advance clock past `expiresAt - 30_000`; verify a second `getToken()` call triggers a new fetch (see Dev Notes for pattern)
  - [ ] Test: OIDC endpoint error → structured MCP error returned
- [ ] Write integration test: multi-engine (AC: 3)
  - [ ] File: `test/integration/auth/multi-engine.test.ts`
  - [ ] Test: two-engine config file → default engine used for calls without engine param; verify request goes to default engine's URL
  - [ ] Test: non-default engine routing → explicitly create a client for the non-default engine by name and verify the request goes to *that* engine's URL (not the default's)
- [ ] Ensure all tests pass in CI without network access (AC: 7)
  - [ ] Add `OPERATON_SKIP_HEALTH_CHECK=true` to test environment
  - [ ] Verify `vitest` test run completes with all mocks in place

## Dev Notes

### Mock Infrastructure Choice

Use `msw` v2 for Node.js HTTP interception — it intercepts `fetch()` calls at the platform level, works with Vitest, and supports both REST and error scenarios cleanly.

```typescript
// test/integration/helpers/mock-oidc-server.ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export function createMockOidcHandler(tokenUrl: string, options?: {
  status?: number;
  expiresIn?: number;
  token?: string;
}) {
  return http.post(tokenUrl, () => {
    if (options?.status && options.status >= 400) {
      return new HttpResponse(null, { status: options.status });
    }
    return HttpResponse.json({
      access_token: options?.token ?? 'mock-access-token',
      expires_in: options?.expiresIn ?? 3600,
      token_type: 'Bearer',
    });
  });
}
```

### Request Header Capture Pattern

```typescript
// test/integration/helpers/mock-operaton-server.ts
let capturedAuthHeader: string | null = null;

export const captureAuthHeader = http.get('*/engine', ({ request }) => {
  capturedAuthHeader = request.headers.get('Authorization');
  return HttpResponse.json([{ name: 'default' }]);
});

export function getLastAuthHeader(): string | null {
  return capturedAuthHeader;
}

// Call this in afterEach alongside server.resetHandlers() to prevent stale header state leaking between tests
export function resetCapturedAuthHeader(): void {
  capturedAuthHeader = null;
}
```

### Test Structure

```typescript
// test/integration/auth/oidc-auth.test.ts
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { createMockOidcHandler } from '../helpers/mock-oidc-server.js';
import { captureAuthHeader, getLastAuthHeader, resetCapturedAuthHeader } from '../helpers/mock-operaton-server.js';
import { clearTokenManagerRegistry } from '../../../src/auth/token-manager.js';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  resetCapturedAuthHeader();  // prevent stale header state between tests
  clearTokenManagerRegistry();
  vi.useRealTimers();         // restore real timers if any test used fake timers
});
afterAll(() => server.close());

it('fetches bearer token and includes it in requests', async () => {
  server.use(
    createMockOidcHandler('https://auth.example.com/token', { token: 'my-token' }),
    captureAuthHeader
  );
  // ... invoke tool call with OIDC engine config
  expect(getLastAuthHeader()).toBe('Bearer my-token');
});
```

### Fake Timer Pattern for Token Expiry Tests (AC 5)

Do NOT use `expiresIn: 1` and `await sleep(31_000)` — that makes CI slow and flaky. Use Vitest fake timers to advance the clock:

```typescript
it('refreshes token after expiry', async () => {
  vi.useFakeTimers();
  let fetchCount = 0;

  server.use(
    http.post('https://auth.example.com/token', () => {
      fetchCount++;
      return HttpResponse.json({ access_token: `token-${fetchCount}`, expires_in: 60 });
    })
  );

  const manager = new TokenManager(oidcConfig);

  const token1 = await manager.getToken();
  expect(token1).toBe('token-1');
  expect(fetchCount).toBe(1);

  // Advance clock past expiry threshold (60s - 30s buffer = 30s from now)
  vi.advanceTimersByTime(31_000);

  const token2 = await manager.getToken();
  expect(token2).toBe('token-2');
  expect(fetchCount).toBe(2);  // new fetch triggered
});
```

### Key File Locations

- `test/integration/auth/basic-auth.test.ts` — new
- `test/integration/auth/oidc-auth.test.ts` — new
- `test/integration/auth/multi-engine.test.ts` — new
- `test/integration/helpers/mock-oidc-server.ts` — new
- `test/integration/helpers/mock-operaton-server.ts` — new

### References

- Story 10.1: `ResolvedConfig` and config file format
- Story 10.2: `TokenManager`, `clearTokenManagerRegistry()`
- Story 10.3: `createOperatonClient()`, `checkConnectivity()`
- Existing integration test patterns in `test/integration/`
