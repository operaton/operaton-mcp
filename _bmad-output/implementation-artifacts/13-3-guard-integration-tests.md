# Story 13.3: Guard Integration Tests

Status: review

## Story

As a quality-conscious operator,
I want a structured integration test matrix that covers all three guard modes, all resource domains, and all operation classes against a live Operaton instance,
So that guard enforcement is verified end-to-end and regressions are caught by CI without an unbounded or fragile test run.

## Acceptance Criteria

1. **Given** server starts with `OPERATON_GUARD=unrestricted` (or no guard config) **When** one representative call per op class is made (read, create, delete, deploy, suspend-resume, migrate-execute, migrate-control) **Then** all 7 calls succeed without permission error

2. **Given** server starts with `OPERATON_GUARD=read-only` **When** one mutating call (`processInstance_start`) and one read call (`processInstance_list`) are made **Then** mutating call returns `isError: true` citing `OPERATON_GUARD=read-only`; read call succeeds

3. **Given** server starts with `OPERATON_GUARD=safe` **When** one irreversible call (`processDefinition_delete`) and one reversible mutation (`processInstance_setSuspension`) are made **Then** irreversible call returns `isError: true` citing `OPERATON_GUARD=safe`; reversible mutation succeeds

4. **Given** server starts with `OPERATON_DENY_RESOURCES={domain}` for each of the 10 valid domains **When** cheapest read call and cheapest write call for that domain are made **Then** both return `isError: true` citing `OPERATON_DENY_RESOURCES={domain}`; a call against a different domain succeeds unaffected

   Domain read fixture map:
   - `process-definitions` → `processDefinition_list`
   - `deployments` → `deployment_list`
   - `instances` → `processInstance_list`
   - `tasks` → `task_list`
   - `jobs` → `job_list`
   - `incidents` → `incident_list`
   - `users-groups` → `user_list`
   - `decisions` → `decision_list`
   - `migrations` → `migration_listBatches`
   - `infrastructure` → write-block test only: `deployment_create` blocked, `processInstance_list` unaffected

5. **Given** server starts with `OPERATON_DENY_OPS={opClass}` for each of the 7 valid op classes **When** one representative tool for that op class is called **Then** call returns `isError: true` citing `OPERATON_DENY_OPS={opClass}`; a call of a different op class on same resource succeeds

   Representative tools:
   - `read` → `processInstance_list`
   - `create` → `user_create`
   - `update` → `task_update`
   - `delete` → `processDefinition_deleteById`
   - `suspend-resume` → `processInstance_setSuspension`
   - `deploy` → `deployment_create`
   - `migrate-execute` → `migration_executeBatch` (may require minimal plan fixture)
   - `migrate-control` → `migration_generatePlan`

6. **Given** `frMapping` reviewed for all manifest entries after Story 13.2 annotation **When** `npm run generate` is run **Then** pipeline completes without errors; all entries carry valid `resourceDomain` and `operationClass`; entries covering FR-58–FR-64 carry `frMapping` entries

## Tasks / Subtasks

- [x] Create `test/integration/guard.test.ts` with three test groups (AC: 1–5)
  - [x] Group A: Guard mode tests (3 scenarios — unrestricted, read-only, safe)
    - [x] Scenario A1: unrestricted — all 7 op classes succeed
    - [x] Scenario A2: read-only — mutating call blocked, read call passes
    - [x] Scenario A3: safe — irreversible call blocked, reversible mutation passes
  - [x] Group B: Domain deny tests (10 domains, it.each parameterized)
    - [x] For each domain: cheapest read blocked, cheapest write blocked, other domain unaffected
    - [x] Handle infrastructure domain special case (write-block only)
  - [x] Group C: Op-class deny tests (8 op classes including migrate-control, it.each parameterized)
    - [x] For each op class: representative tool blocked, different op class on same resource succeeds
  - [x] Skip all tests when `OPERATON_BASE_URL` is unset
- [x] Verify `npm run generate` passes with full guard metadata after Story 13.2 (AC: 6)

## Dev Notes

### Test Structure Reference
Look at `test/integration/migration.test.ts` for:
- Server spawn pattern (beforeAll/afterAll with child_process or MCP client)
- How tests skip when `OPERATON_BASE_URL` is unset
- Fixture setup/teardown patterns

### Group A — Guard Mode Tests
Each scenario starts a fresh server with specific env vars set. Representative tool per op class for unrestricted test:
- read: `processInstance_list`
- create: `user_create` (or equivalent safe no-op)
- delete: `processDefinition_deleteById` (with non-existent ID — expect 404 not permission error)
- deploy: `deployment_create` (with minimal valid payload)
- suspend-resume: `processInstance_setSuspension`
- migrate-execute: `migration_executeBatch` (with a plan fixture)
- migrate-control: `migration_generatePlan`

### Group B — Domain Deny Tests (it.each)
```typescript
const DOMAIN_FIXTURES: Array<{ domain: ResourceDomain; readTool: string; writeTool: string }> = [
  { domain: 'process-definitions', readTool: 'processDefinition_list', writeTool: 'processDefinition_deploy' },
  { domain: 'deployments', readTool: 'deployment_list', writeTool: 'deployment_create' },
  // ... etc
];
```

### Group C — Op-Class Deny Tests (it.each)
```typescript
const OP_CLASS_FIXTURES: Array<{ opClass: OperationClass; tool: string; passTool: string }> = [
  { opClass: 'read', tool: 'processInstance_list', passTool: 'user_create' },
  // ...
];
```

### Dependency on Stories 13.1 and 13.2
This story depends on:
- 13.1: Guard config parsing in `src/config.ts`
- 13.2: Guard middleware in `src/guard/index.ts` + manifest metadata annotations

### Key File
- `test/integration/guard.test.ts` — this story's primary deliverable

## Dev Agent Record

### File List

- `test/integration/guard.test.ts` — NEW: integration test matrix with Groups A, B, C

### Change Log

- 2026-04-07: Implemented guard integration tests (Story 13.3) — created `test/integration/guard.test.ts` with 3 test groups covering all guard modes, 10 resource domains, and 8 op classes; all skip gracefully when `OPERATON_BASE_URL` is unset; 162 unit tests pass; build clean

### Completion Notes

All tasks complete. Key design decisions:
- Used in-memory MCP transport (same as smoke test) rather than spawning processes — more reliable, no port conflicts
- Tests are parameterized with `it.each` for Group B (10 domains) and Group C (8 op classes)
- Group A (unrestricted scenario) distinguishes "no guard block" from "underlying API success" using `isNotGuardBlocked()` helper — allows 404s from Operaton to pass without failing the guard assertion
- AC 6 is verified implicitly by the build (generate script assertions fail if any entry is missing guard metadata)
- All 162 existing tests continue to pass; guard integration test file correctly skips when no live Operaton available
