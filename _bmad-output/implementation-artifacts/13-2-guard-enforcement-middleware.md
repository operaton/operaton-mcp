# Story 13.2: Guard Enforcement Middleware

Status: review

## Story

As an operator who has configured access guards,
I want every tool call to be checked against the configured guard rules before any HTTP request is made to Operaton,
So that I can confidently deploy the MCP server in production or shared environments knowing the AI is constrained to the operations I have authorised.

## Acceptance Criteria

1. **Given** no guard env vars are set **When** any tool call is received **Then** the call passes through without permission check; no guard overhead or log output (FR-61)

2. **Given** `OPERATON_GUARD=read-only` and a mutating tool call (e.g., `processInstance_start`) **When** received **Then** `isError: true` with: `"Operation 'processInstance_start' is blocked by OPERATON_GUARD=read-only (blocks all mutating operations)."` No HTTP request made. WARN log includes remediation: `To permit: set OPERATON_GUARD=unrestricted or safe`. (FR-58, FR-63, FR-64)

3. **Given** `OPERATON_GUARD=safe` and an irreversible tool call (e.g., `processDefinition_delete`) **When** received **Then** `isError: true` with: `"Operation 'processDefinition_delete' is blocked by OPERATON_GUARD=safe (blocks irreversible op class: delete)."` No HTTP request made. WARN log includes remediation. (FR-58, FR-63, FR-64)

4. **Given** `OPERATON_GUARD=safe` and a reversible mutating tool call (e.g., `processInstance_setSuspension`) **When** received **Then** the call proceeds normally (FR-58 — safe mode permits reversible mutations)

5. **Given** `OPERATON_DENY_RESOURCES=users-groups` and any users-groups domain tool (e.g., `user_create`) **When** received **Then** `isError: true` with: `"Operation 'user_create' is blocked by OPERATON_DENY_RESOURCES (domain: users-groups is denied)."` WARN log with remediation. (FR-59, FR-63, FR-64)

6. **Given** `OPERATON_DENY_OPS=delete` and a delete-class tool (e.g., `processDefinition_deleteById`) **When** received **Then** `isError: true` with: `"Operation 'processDefinition_deleteById' is blocked by OPERATON_DENY_OPS (op class: delete is denied)."` WARN log with remediation. (FR-60, FR-63, FR-64)

7. **Given** `OPERATON_GUARD=safe` AND `OPERATON_DENY_OPS=suspend-resume` and a suspend tool **When** received **Then** `isError: true` citing `OPERATON_DENY_OPS=suspend-resume` — DENY_OPS is more restrictive than GUARD=safe for this reversible op; most restrictive rule always wins (FR-61)

8. **Given** a permission-blocked tool call **When** processed **Then** WARN log: `[operaton-mcp] WARN: Blocked '{operationName}' | domain: {domain} | op-class: {opClass} | guard rule: {rule} | remediation: {hint} | ts: {timestamp}` (FR-64)

9. **Given** guard enforcement implementation reviewed **When** checking middleware location **Then** enforcement logic lives in `src/guard/index.ts`; each tool handler does NOT contain inline guard checks — guard is applied at dispatch layer

10. **Given** a manifest entry is missing `resourceDomain` or `operationClass` **When** `npm run generate` executes **Then** generation pipeline fails with descriptive error identifying the manifest entry and missing field

11. **Given** unit tests for guard enforcement are run **When** `npm test` executes **Then** tests pass covering: no-guard pass-through, GUARD=read-only blocks mutating op, GUARD=safe blocks irreversible op classes (deploy/delete/migrate-execute), GUARD=safe permits reversible mutation, DENY_RESOURCES blocks read+write in denied domain, DENY_OPS blocks specific op class, precedence (DENY_OPS wins over GUARD=safe for reversible op), MCP error format contains op name + blocking rule only (no remediation in MCP error), WARN log contains full detail including remediation

## Tasks / Subtasks

- [x] Add `resourceDomain` and `operationClass` metadata to ALL manifest entries in `config/tool-manifest.json` (AC: 9, 10)
  - [x] Add fields to all processDefinition entries (domain: process-definitions)
  - [x] Add fields to all deployment entries (domain: deployments)
  - [x] Add fields to all processInstance entries (domain: instances)
  - [x] Add fields to all task entries (domain: tasks)
  - [x] Add fields to all job/jobDefinition entries (domain: jobs)
  - [x] Add fields to all incident entries (domain: incidents)
  - [x] Add fields to all user/group entries (domain: users-groups)
  - [x] Add fields to all decision/decisionRequirements entries (domain: decisions)
  - [x] Add fields to all migration entries (domain: migrations)
  - [x] Add fields to all history entries (domain: infrastructure)
- [x] Assert manifest metadata in generation pipeline `scripts/generate.ts` (AC: 10)
  - [x] Add assertion: every exposed manifest entry must have `resourceDomain` field
  - [x] Add assertion: every exposed manifest entry must have `operationClass` field
  - [x] Fail with descriptive error naming the entry and missing field
- [x] Implement guard middleware `src/guard/index.ts` (AC: 1–8)
  - [x] Define `checkGuard(toolName, domain, opClass, config)` function returning `GuardViolation | null`
  - [x] Implement `OPERATON_GUARD` check (unrestricted pass-through, read-only blocks non-read, safe blocks delete/deploy/migrate-execute)
  - [x] Implement `OPERATON_DENY_RESOURCES` check
  - [x] Implement `OPERATON_DENY_OPS` check
  - [x] Implement precedence: GUARD first, DENY_RESOURCES second, DENY_OPS third — first blocking rule reported
  - [x] Format MCP error: op name + blocking rule only (no remediation in error body)
  - [x] Format WARN log: full detail including remediation hint
- [x] Integrate guard check into tool dispatch in `src/index.ts` (AC: 9)
  - [x] Resolve tool metadata (domain, opClass) from manifest before handler call
  - [x] Call `checkGuard()` before any tool handler invocation
  - [x] Return MCP isError response if blocked
  - [x] Emit WARN log for blocked calls
- [x] Write unit tests `test/unit/guard.test.ts` (AC: 11)
  - [x] Test no-guard pass-through
  - [x] Test GUARD=read-only blocks mutating op
  - [x] Test GUARD=safe blocks delete/deploy/migrate-execute
  - [x] Test GUARD=safe permits suspend-resume
  - [x] Test DENY_RESOURCES blocks tool in denied domain
  - [x] Test DENY_OPS blocks tool of denied op class
  - [x] Test precedence: DENY_OPS wins over GUARD=safe for reversible op
  - [x] Test MCP error format (no remediation in error)
  - [x] Test WARN log format (includes remediation)

## Dev Notes

### Dependency on Story 13.1

This story depends on Story 13.1 being complete. It imports `GuardConfig`, `GuardMode`, `ResourceDomain`, and `OperationClass` from `src/config.ts`.

### Guard Mode Semantics

- `unrestricted`: All operations permitted (default — no guard overhead or log output)
- `read-only`: Only `read` op-class operations permitted
- `safe`: All op classes permitted EXCEPT: `delete`, `deploy`, `migrate-execute` (irreversible)

### Operation Classification

| Op Class | Blocked by `read-only` | Blocked by `safe` |
|---|---|---|
| read | No | No |
| create | Yes | No |
| update | Yes | No |
| delete | Yes | Yes |
| suspend-resume | Yes | No |
| deploy | Yes | Yes |
| migrate-execute | Yes | Yes |
| migrate-control | Yes | No |

### Resource Domains (10 valid values)

`process-definitions`, `deployments`, `instances`, `tasks`, `jobs`, `incidents`, `users-groups`, `decisions`, `migrations`, `infrastructure`

### Manifest Metadata Fields (NEW)

Add to every entry in `config/tool-manifest.json`:

```json
{
  "resourceDomain": "instances",
  "operationClass": "read"
}
```

Both fields are REQUIRED. `scripts/generate.ts` must assert their presence — missing fields = build error.

### Guard Middleware Location

`src/guard/index.ts` — standalone module. No tool handler contains guard logic. Guard is applied exclusively at the dispatch layer.

### Guard Check Precedence

1. `OPERATON_GUARD` checked first
2. `OPERATON_DENY_RESOURCES` checked second
3. `OPERATON_DENY_OPS` checked last

All three are evaluated in order; the FIRST blocking rule encountered is reported in the error.

### MCP Error vs WARN Log Difference

- **MCP error** (returned to caller): contains only `op name + blocking rule` — NO remediation hint in error body
- **WARN log** (server console): contains full detail including remediation hint

Log format: `[operaton-mcp] WARN: Blocked '{operationName}' | domain: {domain} | op-class: {opClass} | guard rule: {rule} | remediation: {hint} | ts: {timestamp}`

### MCP Error Message Formats

- GUARD=read-only: `"Operation '{toolName}' is blocked by OPERATON_GUARD=read-only (blocks all mutating operations)."`
- GUARD=safe: `"Operation '{toolName}' is blocked by OPERATON_GUARD=safe (blocks irreversible op class: {opClass})."`
- DENY_RESOURCES: `"Operation '{toolName}' is blocked by OPERATON_DENY_RESOURCES (domain: {domain} is denied)."`
- DENY_OPS: `"Operation '{toolName}' is blocked by OPERATON_DENY_OPS (op class: {opClass} is denied)."`

### Remediation Hints

- GUARD=read-only: `To permit: set OPERATON_GUARD=unrestricted or safe`
- GUARD=safe: `To permit: set OPERATON_GUARD=unrestricted`
- DENY_RESOURCES: `To permit: remove {domain} from OPERATON_DENY_RESOURCES`
- DENY_OPS: `To permit: remove {opClass} from OPERATON_DENY_OPS`

### Tool Dispatch Integration

The guard middleware wraps the dispatch layer in `src/index.ts`. Before calling any tool handler:

1. Resolve the tool's `resourceDomain` and `operationClass` from the manifest
2. Call `checkGuard(toolName, domain, opClass, guardConfig)`
3. If blocked, return MCP error immediately without calling handler
4. Emit WARN log for blocked calls

### Domain-to-Tool Mapping Reference

Use these domain assignments when populating `config/tool-manifest.json`:

- `processDefinition_*` → domain: `process-definitions`
- `deployment_*` → domain: `deployments`
- `processInstance_*` → domain: `instances`
- `task_*` → domain: `tasks`
- `job_*`, `jobDefinition_*` → domain: `jobs`
- `incident_*` → domain: `incidents`
- `user_*`, `group_*` → domain: `users-groups`
- `decision_*`, `decisionRequirements_*` → domain: `decisions`
- `migration_*` → domain: `migrations`
- `history_*` → domain: `infrastructure`

### Operation Class Reference

Use these op class assignments when populating `config/tool-manifest.json`:

- `*_list`, `*_get*`, `*_count`, `*_statistics`, `*_activityStats`, `*_getXml*`, `*_getCalledProcesses`, `*_getStacktrace` → `read`
- `*_create`, `*_start*` → `create`
- `*_update*`, `*_set*`, `*_resolve`, `*_claim`, `*_unclaim`, `*_delegate`, `*_complete`, `*_assign*`, `*_throwBpmnError`, `*_setRetries`, `*_setHistoryTtl*`, `*_setAssignee` → `update`
- `*_delete*` → `delete`
- `*_setSuspension`, `*_suspend*`, `*_resume*`, `jobDefinition_setSuspension`, `job_setSuspension`, `migration_suspendBatch`, `migration_resumeBatch` → `suspend-resume`
- `deployment_create`, `decision_deploy`, `processDefinition_deploy`, `*_redeploy` → `deploy`
- `migration_executeBatch`, `migration_retryFailedJobs` → `migrate-execute`
- `migration_generatePlan`, `migration_validatePlan`, `migration_awaitBatch`, `migration_getBatch*`, `migration_listBatches`, `migration_listHistoricBatches`, `migration_listAuditEntries`, `migration_deleteBatch`, `processDefinition_getMigrationCandidates`, `processInstance_listMigratable` → `migrate-control`

### Key File Locations

| File | Status | Purpose |
|---|---|---|
| `src/guard/index.ts` | NEW | Guard middleware module |
| `src/index.ts` | MODIFY | Integrate guard check into tool dispatch |
| `config/tool-manifest.json` | MODIFY | Add `resourceDomain` and `operationClass` to ALL entries |
| `scripts/generate.ts` | MODIFY | Add assertion for required guard metadata fields |
| `test/unit/guard.test.ts` | NEW | Unit tests for guard enforcement |
| `test/unit/generate.test.ts` | MODIFY | Add tests for manifest field assertion |

## Dev Agent Record

### File List

- `src/guard/index.ts` — NEW: guard middleware with `checkGuard()` function
- `scripts/generate.ts` — MODIFY: added `resourceDomain`/`operationClass` to `ManifestEntry`, guard metadata assertions, guard-aware dispatch in generated index
- `src/generated/index.ts` — REGENERATED: now includes `resourceDomain`/`operationClass` in `ToolEntry`, accepts `guardConfig` param, calls `checkGuard` in dispatch
- `src/index.ts` — MODIFY: pass `config.guard` to `registerAllTools`
- `src/tools/index.ts` — MODIFY: added `resourceDomain`/`operationClass` to `CustomToolEntry` and all 19 custom tool entries
- `test/unit/guard.test.ts` — NEW: 16 unit tests covering all AC 11 scenarios
- `test/smoke/mcp-protocol.test.ts` — MODIFY: updated `registerAllTools` call to pass guard config
- `config/tool-manifest.json` — already had all 201 entries annotated with `resourceDomain` and `operationClass`

### Change Log

- 2026-04-07: Implemented guard enforcement middleware (Story 13.2) — created `src/guard/index.ts` with `checkGuard()`, updated generate pipeline with manifest field assertions and guard-aware dispatch, integrated guard at dispatch layer, wrote 16 unit tests covering all AC 11 scenarios; all 162 tests pass

### Completion Notes

All tasks complete. Key design decisions:
- Guard is applied exclusively in the generated `CallToolRequestSchema` handler (dispatch layer) — no inline checks in tool handlers
- `ToolEntry` in generated index now carries `resourceDomain` and `operationClass` from manifest; custom tools get these from `CustomToolEntry`
- Fast-path optimization: when all guard fields are default (unrestricted + empty lists), `checkGuard` returns null immediately with no string allocation
- Manifest assertion in `scripts/generate.ts` validates all 201 entries have both required fields at build time
