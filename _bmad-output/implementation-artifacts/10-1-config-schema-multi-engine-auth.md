# Story 10.1: Config Schema — Multi-Engine & Auth Type Discriminator

Status: ready-for-dev

## Story

As an engineer deploying operaton-mcp,
I want to configure one or more Operaton engines with either Basic Auth or OIDC client credentials,
so that the server connects to the right engine with the right authentication strategy at startup.

## Acceptance Criteria

1. **Given** `OPERATON_BASE_URL`, `OPERATON_USERNAME`, `OPERATON_PASSWORD` are set and no `OPERATON_CONFIG` is set **When** the server starts **Then** it runs in legacy single-engine basic-auth mode with zero config changes required from existing users.

2. **Given** `OPERATON_BASE_URL`, `OPERATON_CLIENT_ID`, `OPERATON_CLIENT_SECRET`, `OPERATON_TOKEN_URL` are set and no `OPERATON_CONFIG` is set **When** the server starts **Then** it runs in single-engine OIDC mode.

3. **Given** `OPERATON_CONFIG` points to a valid JSON config file with an `engines` map **When** the server starts **Then** it loads all named engines, identifies the default engine (the one with `"default": true`, or the only engine if there is exactly one), and fails fast if no default can be determined.

4. **Given** a config file with multiple engines but no `"default": true` **When** the server starts **Then** it exits with `[operaton-mcp] Error: Multiple engines configured but none marked as default. Set "default": true on exactly one engine.`

5. **Given** a config file with two engines both marked `"default": true` **When** the server starts **Then** it exits with `[operaton-mcp] Error: Multiple engines marked as default. Exactly one engine must have "default": true.`

6. **Given** a config file with a `"basic"` auth type engine **When** `loadConfig()` is called **Then** the engine config has `authentication.type === "basic"` with `username` and `password` fields.

7. **Given** a config file with an `"oidc"` auth type engine **When** `loadConfig()` is called **Then** the engine config has `authentication.type === "oidc"` with `clientId`, `clientSecret`, and `tokenUrl` fields.

8. **Given** `OPERATON_CONFIG` path does not exist **When** the server starts **Then** it exits with `[operaton-mcp] Error: Config file not found: {path}`.

9. **Given** `OPERATON_CONFIG` points to a file with invalid JSON **When** the server starts **Then** it exits with `[operaton-mcp] Error: Failed to parse config file: {reason}`.

10. **Given** both `OPERATON_USERNAME` and `OPERATON_CLIENT_ID` are set (no `OPERATON_CONFIG`) **When** the server starts **Then** it exits with `[operaton-mcp] Error: Ambiguous authentication config: both OPERATON_USERNAME (basic) and OPERATON_CLIENT_ID (oidc) are set. Use only one auth mode, or use OPERATON_CONFIG for multi-engine setups.`

11. **Given** neither `OPERATON_CONFIG`, `OPERATON_USERNAME`, nor `OPERATON_CLIENT_ID` is set **When** the server starts **Then** it exits with:
    ```
    [operaton-mcp] Error: No configuration found. Provide one of:
      Basic Auth:  OPERATON_BASE_URL + OPERATON_USERNAME + OPERATON_PASSWORD
      OIDC:        OPERATON_BASE_URL + OPERATON_CLIENT_ID + OPERATON_CLIENT_SECRET + OPERATON_TOKEN_URL
      Multi-engine: OPERATON_CONFIG=/path/to/config.json
    ```

## Tasks / Subtasks

- [ ] Define new TypeScript types in `src/config.ts` (AC: 6, 7)
  - [ ] `BasicAuthConfig`: `{ type: 'basic'; username: string; password: string }`
  - [ ] `OidcAuthConfig`: `{ type: 'oidc'; clientId: string; clientSecret: string; tokenUrl: string }`
  - [ ] `AuthConfig`: union of `BasicAuthConfig | OidcAuthConfig`
  - [ ] `EngineConfig`: `{ url: string; default?: boolean; authentication: AuthConfig }`
  - [ ] `MultiEngineConfig`: `{ engines: Record<string, EngineConfig> }`
  - [ ] `ResolvedConfig`: runtime config with `engines: Record<string, EngineConfig>`, `defaultEngine: string`, `skipHealthCheck: boolean`
  - [ ] Remove old flat `Config` interface (replace with `ResolvedConfig`)
- [ ] Implement `loadConfig(): ResolvedConfig` with three resolution paths (AC: 1, 2, 3)
  - [ ] Path A — `OPERATON_CONFIG` is set: read and parse JSON file, validate schema, resolve default engine
  - [ ] Path B — env vars with `OPERATON_USERNAME` set: build basic-auth single-engine config
  - [ ] Path C — env vars with `OPERATON_CLIENT_ID` set: build OIDC single-engine config
  - [ ] Path B/C: engine name defaults to `OPERATON_ENGINE` env var or `"default"`
  - [ ] Ambiguity guard: if both `OPERATON_USERNAME` and `OPERATON_CLIENT_ID` are set → exit with AC 10 error message
  - [ ] No-config guard: if none of `OPERATON_CONFIG`, `OPERATON_USERNAME`, `OPERATON_CLIENT_ID` is set → exit with AC 11 error message
- [ ] Validate multi-engine default resolution (AC: 4, 5)
  - [ ] Count engines with `default: true`; exit with error if 0 and >1 engine
  - [ ] Exit with error if >1 engine has `default: true`
  - [ ] If exactly 1 engine total (no `default` field), promote it to default automatically
- [ ] Handle config file errors (AC: 8, 9)
  - [ ] `ENOENT` → exit with file-not-found message
  - [ ] JSON.parse failure → exit with parse error message
- [ ] Update `src/index.ts` to use `ResolvedConfig` (no logic change, just type update)
- [ ] Update `src/http/client.ts` to accept `EngineConfig` instead of flat username/password fields
- [ ] Write unit tests for all config resolution paths
  - [ ] Legacy env vars (basic) → ResolvedConfig with basic auth default engine
  - [ ] Env vars OIDC → ResolvedConfig with OIDC auth default engine
  - [ ] Config file single engine (basic) → correct ResolvedConfig
  - [ ] Config file single engine (OIDC) → correct ResolvedConfig
  - [ ] Config file two engines, one default → correct defaultEngine name resolved
  - [ ] Config file two engines, no default → process.exit with correct message
  - [ ] Config file two engines, both default → process.exit with correct message
  - [ ] Config file not found → process.exit with file-not-found message
  - [ ] Config file invalid JSON → process.exit with parse error message
  - [ ] Both OPERATON_USERNAME and OPERATON_CLIENT_ID set → process.exit with ambiguity message (AC: 10)
  - [ ] No config, no username, no clientId → process.exit with no-configuration message (AC: 11)

## Dev Notes

### Architecture Rules (must not break)

- **`src/config.ts` remains the ONLY file that reads `process.env` and the filesystem for config.** All other modules receive typed config objects as parameters.
- **Fail-fast:** any config error must `process.exit(1)` with a descriptive `[operaton-mcp] Error: ...` message before any other initialization occurs.
- **Backward compatibility is mandatory.** Existing Claude Desktop configs using `OPERATON_BASE_URL` + `OPERATON_USERNAME` + `OPERATON_PASSWORD` must work without any changes.

### New Types

```typescript
// src/config.ts

export interface BasicAuthConfig {
  type: 'basic';
  username: string;
  password: string;
}

export interface OidcAuthConfig {
  type: 'oidc';
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

export interface ResolvedConfig {
  engines: Record<string, EngineConfig>;
  defaultEngine: string;      // key into engines map
  skipHealthCheck: boolean;
}
```

### Config File Format

```json
{
  "engines": {
    "dev": {
      "url": "http://localhost:8080/engine-rest",
      "authentication": {
        "type": "basic",
        "username": "demo",
        "password": "demo"
      }
    },
    "quality-stage": {
      "url": "https://operaton.example.com/engine-rest",
      "default": true,
      "authentication": {
        "type": "oidc",
        "clientId": "mcp-client",
        "clientSecret": "secret",
        "tokenUrl": "https://keycloak.example.com/realms/myapp/protocol/openid-connect/token"
      }
    }
  }
}
```

### Environment Variable Reference (updated)

| Variable | Required (env mode) | Default | Description |
|---|---|---|---|
| `OPERATON_CONFIG` | No | — | Path to JSON config file (enables multi-engine mode) |
| `OPERATON_BASE_URL` | Yes (if no config file) | — | Base URL of Operaton REST API |
| `OPERATON_USERNAME` | Yes (basic auth env mode) | — | Basic Auth username |
| `OPERATON_PASSWORD` | Yes (basic auth env mode) | — | Basic Auth password |
| `OPERATON_CLIENT_ID` | Yes (OIDC env mode) | — | OIDC client ID |
| `OPERATON_CLIENT_SECRET` | Yes (OIDC env mode) | — | OIDC client secret |
| `OPERATON_TOKEN_URL` | Yes (OIDC env mode) | — | OIDC token endpoint URL |
| `OPERATON_ENGINE` | No | `"default"` | Engine name (env mode only) |
| `OPERATON_SKIP_HEALTH_CHECK` | No | `false` | Skip startup connectivity check |

### Resolution Priority

1. If `OPERATON_CONFIG` is set → file-based config (multi-engine capable)
2. Else if both `OPERATON_USERNAME` and `OPERATON_CLIENT_ID` are set → **exit with ambiguity error** (AC 10)
3. Else if `OPERATON_USERNAME` is set → legacy basic-auth single-engine config
4. Else if `OPERATON_CLIENT_ID` is set → OIDC single-engine config
5. Else → exit with no-configuration error listing all required variables per mode (AC 11)

### Key File Locations

- `src/config.ts` — all config types and `loadConfig()` implementation
- `src/http/client.ts` — update function signatures to use `EngineConfig`
- `test/unit/config.test.ts` — extend existing test file

### References

- Existing story: `_bmad-output/implementation-artifacts/1-2-configuration-module-and-startup-validation.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md#Authentication & Security`
- Follow-on: Story 10.2 (TokenManager), Story 10.3 (multi-engine routing)
