# Story 13.1: Guard Config Schema & Startup Validation

Status: review

## Story

As an operator deploying operaton-mcp in a shared or production environment,
I want the server to validate all guard-related environment variables at startup and refuse to start with an invalid configuration,
So that misconfigured guards are caught immediately and the server never runs in an indeterminate access control state.

## Acceptance Criteria

1. **Given** `OPERATON_GUARD` is set to an unrecognised value (e.g., `"strict"`) **When** the server starts **Then** it exits immediately with `[operaton-mcp] Invalid OPERATON_GUARD value: "strict". Valid values: unrestricted, read-only, safe` and a non-zero exit code (FR-62)

2. **Given** `OPERATON_DENY_RESOURCES` contains an unrecognised domain (e.g., `"deployments,widgets"`) **When** the server starts **Then** it exits immediately with `[operaton-mcp] Invalid OPERATON_DENY_RESOURCES entry: "widgets". Valid domains: process-definitions, deployments, instances, tasks, jobs, incidents, users-groups, decisions, migrations, infrastructure` (FR-62)

3. **Given** `OPERATON_DENY_OPS` contains an unrecognised operation class (e.g., `"delete,invent"`) **When** the server starts **Then** it exits immediately with `[operaton-mcp] Invalid OPERATON_DENY_OPS entry: "invent". Valid classes: read, create, update, delete, suspend-resume, deploy, migrate-execute, migrate-control` (FR-62)

4. **Given** `OPERATON_GUARD`, `OPERATON_DENY_RESOURCES`, and `OPERATON_DENY_OPS` are all absent or empty **When** the server starts **Then** it starts successfully with no guard-related log output; all operations are permitted (FR-61 — unrestricted default)

5. **Given** all guard env vars contain valid values **When** the server starts **Then** it logs the active guard configuration at INFO level: `[operaton-mcp] Guard: OPERATON_GUARD=safe OPERATON_DENY_RESOURCES=users-groups OPERATON_DENY_OPS=` and proceeds normally

6. **Given** `src/config.ts` is reviewed after this story **When** checking guard config parsing **Then** guard config parsing is handled exclusively in `src/config.ts` alongside existing env var loading; no other file reads these env vars directly

7. **Given** unit tests for guard config validation are run **When** `npm test` executes **Then** tests pass covering: valid OPERATON_GUARD values (all 3), invalid OPERATON_GUARD value, valid domain list, invalid domain entry, valid op-class list, invalid op-class entry, empty/absent config (unrestricted default)

8. **Given** the server is spawned as a child process with an invalid guard env var (e.g., `OPERATON_GUARD=strict`) **When** the process exits **Then** the exit code is non-zero and stderr contains the expected descriptive error message (startup validation confirmed as an integration-level test; does not require a live Operaton instance)

## Tasks / Subtasks

- [x] Extend `src/config.ts` with guard config schema and parsing (AC: 1–6)
  - [x] Define `GuardConfig` interface with `mode`, `denyResources`, `denyOps` fields
  - [x] Define valid value constants: `VALID_GUARD_MODES`, `VALID_RESOURCE_DOMAINS`, `VALID_OP_CLASSES`
  - [x] Implement `loadGuardConfig()` that reads and validates `OPERATON_GUARD`, `OPERATON_DENY_RESOURCES`, `OPERATON_DENY_OPS`
  - [x] Exit with descriptive error for invalid `OPERATON_GUARD` value
  - [x] Exit with descriptive error for invalid `OPERATON_DENY_RESOURCES` entry (first invalid entry)
  - [x] Exit with descriptive error for invalid `OPERATON_DENY_OPS` entry (first invalid entry)
  - [x] Emit INFO log if any guard config is active (non-default)
  - [x] Extend `ResolvedConfig` interface to include `guard: GuardConfig`
  - [x] Call `loadGuardConfig()` from `loadConfig()` and store in returned config
- [x] Write unit tests for guard config validation (AC: 7)
  - [x] Test valid `OPERATON_GUARD` values (all 3)
  - [x] Test invalid `OPERATON_GUARD` value triggers exit with correct message
  - [x] Test valid `OPERATON_DENY_RESOURCES` list
  - [x] Test invalid `OPERATON_DENY_RESOURCES` entry triggers exit with correct message
  - [x] Test valid `OPERATON_DENY_OPS` list
  - [x] Test invalid `OPERATON_DENY_OPS` entry triggers exit with correct message
  - [x] Test empty/absent guard config results in unrestricted default (no exit)
- [x] Write integration test: startup validation (AC: 8)
  - [x] Spawn child process with `OPERATON_GUARD=strict` (no other env vars needed)
  - [x] Assert non-zero exit code
  - [x] Assert stderr contains `Invalid OPERATON_GUARD value: "strict"`

## Dev Notes

### Guard Config Schema

```typescript
export type GuardMode = 'unrestricted' | 'read-only' | 'safe';
export type ResourceDomain = 'process-definitions' | 'deployments' | 'instances' | 'tasks' | 'jobs' | 'incidents' | 'users-groups' | 'decisions' | 'migrations' | 'infrastructure';
export type OperationClass = 'read' | 'create' | 'update' | 'delete' | 'suspend-resume' | 'deploy' | 'migrate-execute' | 'migrate-control';

export interface GuardConfig {
  mode: GuardMode;           // default: 'unrestricted'
  denyResources: ResourceDomain[];  // default: []
  denyOps: OperationClass[];        // default: []
}
```

### Error Message Formats (exact)
- Invalid mode: `[operaton-mcp] Invalid OPERATON_GUARD value: "<value>". Valid values: unrestricted, read-only, safe`
- Invalid resource: `[operaton-mcp] Invalid OPERATON_DENY_RESOURCES entry: "<value>". Valid domains: process-definitions, deployments, instances, tasks, jobs, incidents, users-groups, decisions, migrations, infrastructure`
- Invalid op class: `[operaton-mcp] Invalid OPERATON_DENY_OPS entry: "<value>". Valid classes: read, create, update, delete, suspend-resume, deploy, migrate-execute, migrate-control`

### INFO Log Format
`[operaton-mcp] Guard: OPERATON_GUARD=<val> OPERATON_DENY_RESOURCES=<val> OPERATON_DENY_OPS=<val>`
Only emit when at least one guard env var is set (not when all absent/empty).

### Existing Pattern to Follow
`src/config.ts` uses `console.error()` + `process.exit(1)` for validation failures. All guard parsing must live exclusively in `src/config.ts`.

### Unit Test Approach
Mock `process.env` and spy on `process.exit` + `console.error`. Pattern: set env vars, call `loadGuardConfig()`, verify exit/log behavior. Look at existing config tests if any.

### Integration Test for Startup Validation
Use Node.js `child_process.spawnSync` to spawn `node dist/index.js` (or the built entry point) with `OPERATON_GUARD=strict` in the env, without `OPERATON_BASE_URL`. Check `status !== 0` and `stderr` contains the error message. This test does NOT need a live Operaton instance — it only tests early exit before any connection attempt.

### Key File Locations
- `src/config.ts` — add guard config here
- `test/unit/config.test.ts` — unit tests (create if not exists)
- `test/integration/guard-startup.test.ts` — startup validation integration test

### Dependency on Story 13.2
The `GuardConfig` type exported from `src/config.ts` in this story is consumed by the guard middleware in Story 13.2. Keep types exported so middleware can import them.

## Dev Agent Record

### File List

- `src/config.ts` — added `GuardMode`, `ResourceDomain`, `OperationClass` types; `GuardConfig` interface; `VALID_*` constants; `loadGuardConfig()`; extended `ResolvedConfig` with `guard`
- `test/unit/config.test.ts` — added `loadGuardConfig` test suite (11 tests)
- `test/integration/guard-startup.test.ts` — new startup validation integration tests (3 tests)

### Change Log

- Added guard config schema and parsing to `src/config.ts` (2026-04-07)

### Completion Notes

All 3 tasks complete. 144 tests passing, no regressions. `GuardConfig` types exported for use by Story 13.2 guard middleware.
