---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
---

# operaton-mcp - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for operaton-mcp, decomposing the requirements from the PRD and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-01 (W): Users can deploy a process definition by submitting a BPMN or DMN artifact; the server returns the deployment ID and process definition key on success, or a structured error with cause on failure.

FR-02 (R): Users can list deployed process definitions, optionally filtered by key, name, version, or tenant; results include definition ID, key, name, version, and deployment ID.

FR-03 (R): Users can retrieve the metadata and BPMN/DMN XML of a specific process definition by ID or key.

FR-04 (W): Users can delete a process definition by ID; the server returns confirmation on success or an error if active instances exist.

FR-05 (W): Users can start a process instance from a deployed process definition, optionally supplying initial variables and a business key; the server returns the instance ID, definition key, and current state on success.

FR-06 (R): Users can query active process instances, filtered by definition key, business key, variable values, incident presence, or suspension state; results include instance ID, definition key, business key, start time, and state.

FR-07 (W): Users can suspend an active process instance by ID; the server returns confirmation or an error if the instance is not in a suspendable state.

FR-08 (W): Users can resume a suspended process instance by ID; the server returns confirmation or an error if the instance is not suspended.

FR-09 (W): Users can delete a process instance by ID with an optional deletion reason; the server returns confirmation on success.

FR-10 (R/W): Users can read process instance variables by instance ID, returning name, type, and value for each variable. Users can write or update variables by instance ID; write operations return confirmation or a structured error on failure.

FR-11 (R): Users can query user tasks, filtered by assignee, candidate group, process instance ID, task definition key, or due date; results include task ID, name, assignee, candidate groups, priority, due date, and process instance ID.

FR-12 (W): Users can claim a task by task ID and assignee; the server returns confirmation or an error if the task is already claimed or does not exist.

FR-13 (W): Users can unclaim a task by task ID; the server returns confirmation.

FR-14 (W): Users can complete a task by task ID, optionally supplying completion variables; the server returns confirmation or an error if the task cannot be completed.

FR-15 (W): Users can delegate a task to another user by task ID; the server returns confirmation or an error.

FR-16 (W): Users can set task-local variables on a task by task ID; the server returns confirmation or a structured error on failure.

FR-17 (R): Users can query jobs, filtered by process instance ID, job definition ID, exception presence, retries remaining, or due date; results include job ID, type, retries, due date, and exception message if present.

FR-18 (W): Users can trigger immediate execution of a job by job ID; the server returns confirmation or the exception message if the job fails during execution.

FR-19 (W): Users can suspend a job by job ID or all jobs for a job definition by job definition ID; the server returns confirmation.

FR-20 (W): Users can resume a suspended job by job ID or all suspended jobs for a job definition by job definition ID; the server returns confirmation.

FR-21 (W): Users can set the retry count on a job by job ID; the server returns confirmation or an error.

FR-22 (R): Users can query incidents, filtered by process instance ID, incident type, activity ID, or root cause incident ID; results include incident ID, type, message, activity ID, and affected process instance ID.

FR-23 (W): Users can resolve an incident by incident ID; the server returns confirmation or an error if the incident cannot be resolved.

FR-24 (W): Users can create an Operaton user account by supplying ID, first name, last name, email, and password; the server returns confirmation or an error if the ID already exists.

FR-25 (W): Users can update an existing Operaton user's profile or password by user ID; the server returns confirmation or an error.

FR-26 (W): Users can delete an Operaton user account by user ID; the server returns confirmation or an error if the user does not exist.

FR-27 (R): Users can query Operaton users, filtered by ID, first name, last name, or email; results are returned as a structured list.

FR-28 (W): Users can create or delete groups by group ID and name; each mutating operation returns confirmation or a structured error.

FR-29 (W): Users can add or remove a user from a group; each operation returns confirmation or an error if the user or group does not exist.

FR-30 (R): Users can query historic process instances, filtered by process definition key, business key, start/end date range, or completion state; results include instance ID, definition key, business key, start time, end time, duration, and state.

FR-31 (R): Users can query historic activity instances for a process instance, returning activity ID, name, type, start time, end time, assignee (for user tasks), and duration.

FR-32 (R): Users can query historic task instances, filtered by process instance ID or task definition key; results include task name, assignee, completion time, and duration.

FR-33 (R): Users can query historic variable instances for a process instance, returning variable name, type, value, and the activity instance in which the variable was set.

FR-34 (W): Users can deploy a DMN decision table by submitting a DMN artifact; the server returns the decision definition key and deployment ID on success, or a structured error on failure.

FR-35 (W/R): Users can evaluate a deployed decision table by decision definition key, supplying input variables; the server returns the evaluation result or a structured error if evaluation fails.

### NonFunctional Requirements

NFR-01 — Write Operation Reliability: All mutating tool calls return either explicit success confirmation or a structured error message containing the error type, cause, and recommended corrective action where applicable. Zero silent failures permitted.

NFR-02 — Read Accuracy: Read operations return the current state of the Operaton engine at time of call. Reads during normal engine operation must not return stale or incorrect data.

NFR-03 — MCP Protocol Compliance: The server is compatible with at least Claude Desktop and GitHub Copilot Chat MCP client implementations at launch. Verified by functional integration tests against both clients.

NFR-04 — Stateless Operation: No user-specific session state is stored between tool calls. Each tool call is self-contained, requiring only the configured Operaton connection parameters.

NFR-05 — Error Message Quality: All error responses include: error type, the specific cause, and where applicable a recommended corrective action. Generic "error occurred" messages are not acceptable.

NFR-06 — Configurability: All Operaton connection parameters (base URL, credentials, engine name) are configurable via environment variables. No endpoints, credentials, or engine names are hardcoded.

### Additional Requirements

- **Starter template (Epic 1, Story 1):** Hybrid approach — `@modelcontextprotocol/create-typescript-server` scaffold + `openapi-mcp-generator` + manifest-driven curation. Run scaffold in temp dir and merge into repo; do not run inside existing repo root.
- **Project initialization:** Add `tsc-alias` dev dependency, configure `prepare` script, add `.gitignore` entries (`src/generated/`, `resources/*.prev.json`, `dist/`), add `#!/usr/bin/env node` shebang to `src/index.ts`.
- **Language/runtime:** TypeScript 5.x, ESM (`"type": "module"`), Node.js 22 LTS, strict TypeScript config — frozen, no story may disable flags.
- **MCP SDK:** `@modelcontextprotocol/sdk ^1.27.1`, stdio transport. `console.log()` is forbidden — use `console.error()` only. Log format: `[operaton-mcp] {level}: {message}`.
- **Code generation pipeline:** `scripts/generate.ts` — parse spec → diff → load manifest → validate params → coverage audit → length check → emit `src/generated/{group}/{operationId}.ts` + barrels. Runs via `npm run generate` before `tsc`. Must assert all 305 paths represented.
- **Manifest fixture:** `config/tool-manifest.fixture.json` — 10–15 operations, 2–3 groups, real BPM-domain descriptions + `frMapping` entries. Used for TDD on the generator before full manifest population.
- **Validation:** Zod `^3.x`, `.parse()` (not `.safeParse()`) at handler entry before any HTTP call.
- **HTTP client:** `createOperatonClient` factory with Basic Auth + engine name injected at call time; never raw `fetch()`. All HTTP exclusively through `src/http/client.ts`.
- **Error normalization:** Static map keyed by Operaton error type + BPM-domain hint + fallback (unknown types → generic error preserving raw Operaton body). Fallback key: `"__unknown__"`.
- **Tool naming:** `{groupName}_{verbNoun}` camelCase format, manifest-controlled, max 64 chars.
- **Unknown tool handler:** Returns `"Unknown tool: {name}. Available groups: processDefinition, task, incident, ..."` — enables LLM self-correction.
- **Testing (Vitest):** Unit (mirrors source structure) + smoke (`test/smoke/mcp-protocol.test.ts` with fetch-level mock; `OPERATON_SKIP_HEALTH_CHECK=true`) + integration (live Operaton; write-state tests: `beforeEach` fixture creation + `afterEach` cleanup; skipped if `OPERATON_BASE_URL` unset).
- **CI:** `ci.yml` (build + unit + smoke on all pushes/PRs; no secrets) + `integration.yml` (push to main only; uses `OPERATON_BASE_URL` secret).
- **Distribution:** `npm publish` via `bin` entry (`"operaton-mcp": "./dist/index.js"`); `dist/` gitignored but included in npm package via `files` field; `prepare` script ensures cold-start for contributors.
- **`frMapping` in manifest:** Required key for all 35 PRD FRs; `frMapping: []` valid for non-FR operations; generation pipeline warns on absent key.
- **`src/index.ts`:** Must stay under 50 lines; all tool registration via `registerAllTools(server, client)` from `@generated/index`.
- **Path alias:** `@generated/*` → `src/generated/*` in `tsconfig.json`; `tsc-alias` rewrites aliases in `dist/` post-compilation.
- **NFR-03 release gate:** Manual verification in Claude Desktop + GitHub Copilot Chat before first `npm publish` — `tools/list` + one `tools/call` per FR domain (8 calls) + verify `isError: true` renders correctly.

### UX Design Requirements

Not applicable — operaton-mcp has no UI per PRD scope.

### FR Coverage Map

FR-01: Epic 2 — Deploy BPMN/DMN artifact to Operaton
FR-02: Epic 2 — List deployed process definitions with filters
FR-03: Epic 2 — Retrieve process definition metadata + BPMN XML
FR-04: Epic 2 — Delete process definition by ID
FR-05: Epic 3 — Start process instance with optional variables + business key
FR-06: Epic 3 — Query active process instances with rich filters
FR-07: Epic 3 — Suspend active process instance by ID
FR-08: Epic 3 — Resume suspended process instance by ID
FR-09: Epic 3 — Delete process instance with optional reason
FR-10: Epic 3 — Read/write process instance variables
FR-11: Epic 4 — Query user tasks with rich filters
FR-12: Epic 4 — Claim task by task ID + assignee
FR-13: Epic 4 — Unclaim task by task ID
FR-14: Epic 4 — Complete task with optional variables
FR-15: Epic 4 — Delegate task to another user
FR-16: Epic 4 — Set task-local variables
FR-17: Epic 5 — Query jobs with filters
FR-18: Epic 5 — Trigger immediate job execution
FR-19: Epic 5 — Suspend job or all jobs for a job definition
FR-20: Epic 5 — Resume suspended job or all for a job definition
FR-21: Epic 5 — Set retry count on a job
FR-22: Epic 5 — Query incidents with filters
FR-23: Epic 5 — Resolve incident by ID
FR-24: Epic 6 — Create Operaton user account
FR-25: Epic 6 — Update user profile or password
FR-26: Epic 6 — Delete user account
FR-27: Epic 6 — Query users with filters
FR-28: Epic 6 — Create or delete groups
FR-29: Epic 6 — Add or remove user from group
FR-30: Epic 7 — Query historic process instances
FR-31: Epic 7 — Query historic activity instances
FR-32: Epic 7 — Query historic task instances
FR-33: Epic 7 — Query historic variable instances
FR-34: Epic 8 — Deploy DMN decision table
FR-35: Epic 8 — Evaluate deployed decision table
FR-36: Epic 9 — Operaton license headers on all source files + CI enforcement
FR-37: Epic 9 — CONTRIBUTING.md with license header + conventional commit scopes
FR-38: Epic 9 — SECURITY.md with vulnerability reporting policy
FR-39: Epic 9 — CI workflow enhancements: license check, commitlint, .nvmrc
FR-40: Epic 9 — JReleaser config + auto-changelog + package.json engines field
FR-41: Epic 9 — Release workflow: preliminary/final/dry-run + npm provenance
FR-42: Epic 9 — README tool groups documentation + out-of-scope section

## Epic List

### Epic 1: Working MCP Server — Install, Configure & Connect

Engineers can install operaton-mcp via `npx operaton-mcp`, configure it with environment variables pointing to their Operaton instance, and receive a clear confirmation of connectivity — or a diagnostic error identifying exactly what is misconfigured. This epic delivers the complete technical foundation: project scaffold, config module, HTTP client with Basic Auth, error normalization framework, manifest-driven code generation pipeline (fixture manifest, 10–15 ops), CI workflows, and npm publishing configuration. After this epic, the server is installable, runnable, and ready to have domain tools registered in subsequent epics.

**FRs covered:** None directly (all NFRs addressed: NFR-04 stateless, NFR-05 error quality, NFR-06 env-var config, NFR-01 error framework, NFR-03 MCP protocol compliance via scaffold)
**Note:** Epic 1 contains the largest implementation scope of any epic. Stories must be granular — e.g., "generation pipeline produces correct output for fixture manifest" is one story, not bundled with HTTP client setup.

---

### Epic 2: Process Definition & Deployment Management

Users can deploy BPMN artifacts to Operaton via AI, browse the full list of deployed definitions with optional filters, retrieve definition metadata and BPMN XML, and delete definitions. Complete coverage of the process definition domain.

**FRs covered:** FR-01, FR-02, FR-03, FR-04

---

### Epic 3: Process Instance Lifecycle Control

Users can start process instances, query running instances with rich filters (definition key, business key, variables, incidents, suspension state), and control instance state (suspend, resume, delete). Users can also read and write process variables on live instances.

**FRs covered:** FR-05, FR-06, FR-07, FR-08, FR-09, FR-10

---

### Epic 4: Task Management

Users can query user tasks across the engine with rich filters and take full lifecycle actions — claim, unclaim, complete with variables, delegate to another user, and set task-local variables.

**FRs covered:** FR-11, FR-12, FR-13, FR-14, FR-15, FR-16

---

### Epic 5: Job & Incident Operations

Users can query and control job execution (trigger immediate execution, suspend, resume, set retries) and manage incidents (query, resolve). Together these tools power the production incident response workflow — containing failures and recovering process instances through AI conversation.

**FRs covered:** FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23

---

### Epic 6: User & Group Administration

Administrators can create, update, delete, and query Operaton user accounts, create and delete groups, and manage group membership — full user administration through AI without Cockpit access.

**FRs covered:** FR-24, FR-25, FR-26, FR-27, FR-28, FR-29

---

### Epic 7: Historic Data & Audit

Teams can query historical process instances, activity instances, task completions, and variable history with rich filters. All four query operations are read-only; full audit trail access via AI.

**FRs covered:** FR-30, FR-31, FR-32, FR-33

---

### Epic 8: Decision & DMN Management

Users can deploy DMN decision tables and evaluate deployed decisions with input variables, receiving structured results or diagnostic errors. Completes the full Operaton capability surface alongside BPMN coverage.

**FRs covered:** FR-34, FR-35

---

### Epic 9: OSS Project Standards & Release Automation

operaton-mcp meets open-source project standards: all source files carry the Operaton Apache 2.0 license header, contributors have clear guidance in CONTRIBUTING.md, a SECURITY.md documents the vulnerability reporting policy, CI enforces license headers and conventional commit format, and the project can publish NPM releases and GitHub Releases via a JReleaser-backed release workflow with preliminary/final/dry-run modes. The README documents all tool groups and their operations along with an explicit out-of-scope section.

**FRs covered:** FR-36, FR-37, FR-38, FR-39, FR-40, FR-41, FR-42

---

## Epic 1: Working MCP Server — Install, Configure & Connect

Engineers can install operaton-mcp via `npx operaton-mcp`, configure it with environment variables pointing to their Operaton instance, and receive a clear confirmation of connectivity — or a diagnostic error identifying exactly what is misconfigured. This epic delivers the complete technical foundation: project scaffold, config module, HTTP client with Basic Auth, error normalization framework, manifest-driven code generation pipeline (fixture manifest, 10–15 ops), CI workflows, and npm publishing configuration.

### Story 1.1: Project Scaffold & TypeScript Configuration

As an engineer integrating operaton-mcp,
I want a properly initialized TypeScript project with MCP SDK wiring and correct ESM configuration,
So that the project compiles cleanly, runs via `npx operaton-mcp`, and other contributors can cold-start with `npm install`.

**Acceptance Criteria:**

**Given** the repository is freshly cloned and `npm install` is run
**When** the `prepare` script executes automatically post-install
**Then** no errors are produced and the project is ready to build

**Given** `npm run build` is executed
**When** TypeScript compiles with `strict: true` and `tsc-alias` rewrites path aliases
**Then** `dist/index.js` is produced with `#!/usr/bin/env node` shebang; `@generated/*` aliases resolve correctly at runtime

**Given** `src/index.ts` is inspected
**When** checking line count and logging practices
**Then** it is under 50 lines; `console.log()` is absent throughout the codebase; `console.error()` is the only stdout channel

**Given** `.gitignore` is reviewed
**When** checking excluded paths
**Then** `src/generated/`, `resources/*.prev.json`, and `dist/` are all listed

**Given** `tsconfig.json` is reviewed
**When** checking configuration
**Then** `"type": "module"`, `strict: true`, `paths: { "@generated/*": ["src/generated/*"] }`, `outDir: "dist/"` are all present and frozen

### Story 1.2: Configuration Module & Startup Validation

As an engineer setting up operaton-mcp,
I want the server to fail fast with a clear diagnostic when required environment variables are missing, and warn clearly when Operaton is unreachable,
So that misconfiguration is immediately actionable without inspecting source code.

**Acceptance Criteria:**

**Given** `OPERATON_BASE_URL` is missing from the environment
**When** the server starts
**Then** it exits with `[operaton-mcp] Missing required env var: OPERATON_BASE_URL` and a non-zero exit code

**Given** all required env vars are set but `OPERATON_BASE_URL` points to an unreachable host
**When** the server starts
**Then** it logs `[operaton-mcp] Warning: Cannot reach Operaton at {url}. Verify with: curl -u $OPERATON_USERNAME:$OPERATON_PASSWORD $OPERATON_BASE_URL/engine` and continues without exiting

**Given** `OPERATON_SKIP_HEALTH_CHECK=true` is set
**When** the server starts
**Then** the connectivity check is skipped entirely; no warning is logged

**Given** `OPERATON_ENGINE` is not set
**When** `loadConfig()` is called
**Then** the engine name defaults to `"default"`

**Given** `src/config.ts` is reviewed
**When** checking for `process.env` usage
**Then** `src/config.ts` is the only file that reads `process.env`; all other modules receive config as parameters

### Story 1.3: HTTP Client Factory & Error Normalization

As a developer implementing Operaton tool handlers,
I want a typed HTTP client factory that injects Basic Auth and engine name automatically, and a normalize function that maps Operaton errors to structured MCP error responses,
So that all tool handlers are protected from raw HTTP concerns and no silent failures are possible.

**Acceptance Criteria:**

**Given** `createOperatonClient(config)` is called with valid config
**When** the client makes an HTTP request
**Then** every request includes a `Basic {base64}` Authorization header derived from `OPERATON_USERNAME` and `OPERATON_PASSWORD`; the engine name is resolved into the path at call time, not hardcoded

**Given** Operaton returns a 4xx or 5xx response with a JSON body containing a `type` field matching a known entry in the error map
**When** `normalize(response)` is called
**Then** it returns `{ isError: true, content: [{ type: "text", text: "[{errorType}] {message} — Suggested action: {hint}" }] }` with the BPM-domain hint for that error type

**Given** Operaton returns an error with an unrecognized `type` value
**When** `normalize(response)` is called
**Then** the fallback (`__unknown__`) path is used; the raw Operaton body is preserved in the error text

**Given** raw `fetch()` is searched across all source files
**When** checking the codebase
**Then** no direct `fetch()` calls exist outside `src/http/client.ts`

**Given** unit tests are run for `src/http/client.ts` and `src/http/errors.ts`
**When** `npm test` executes
**Then** all unit tests pass covering: auth header construction, engine name injection, known error type mapping (≥3 types), unknown error fallback

### Story 1.4: Code Generation Pipeline with Fixture Manifest

As a developer maintaining operaton-mcp,
I want a build-time generation script that reads `config/tool-manifest.fixture.json` and produces correctly structured TypeScript files in `src/generated/`,
So that the generation pipeline is TDD-validated before full manifest population and generated code is never manually edited.

**Acceptance Criteria:**

**Given** `config/tool-manifest.fixture.json` exists with 10–15 operations across 2–3 groups, with real BPM-domain descriptions and `frMapping` entries for any FR-mapped operations
**When** `npm run generate` is executed
**Then** `src/generated/{group}/{operationId}.ts` files are emitted for all fixture operations; each exports the handler function and Zod input/response schemas; group barrel `src/generated/{group}/index.ts` and top-level `src/generated/index.ts` with `registerAllTools(server, client)` are emitted

**Given** `resources/operaton-rest-api.json` is present and the coverage audit step runs
**When** a manifest entry references an operationId not found in the spec
**Then** the build fails with a descriptive error identifying the unknown operationId

**Given** a manifest entry's `description` exceeds ~200 characters or an `examples` entry exceeds ~100 characters
**When** the pipeline runs
**Then** a warning is printed to stderr; build continues

**Given** a manifest entry is missing the `frMapping` key entirely (not `frMapping: []` — absent)
**When** the pipeline runs
**Then** a warning is printed to stderr identifying the operationId

**Given** unit tests for generation correctness are run
**When** `npm test` executes
**Then** tests pass covering: correct tool name from manifest, correct Zod param structure, correct auth header in generated handler, `frMapping` presence for FR-mapped entries

### Story 1.5: MCP Server Wiring & Smoke Test

As an MCP client user,
I want the server to respond to `tools/list` with registered tools and handle `tools/call` round-trips correctly — including a structured error for unknown tool names,
So that I can confirm the server is working and LLMs can self-correct when they call an unknown tool.

**Acceptance Criteria:**

**Given** the MCP server starts with `OPERATON_SKIP_HEALTH_CHECK=true`
**When** `tools/list` is called
**Then** at least 1 tool is returned (fixture manifest operations); the response conforms to MCP protocol

**Given** `tools/call` is invoked with a tool name from the fixture manifest and a fetch-level mock returns a minimal valid Operaton response
**When** the call completes
**Then** the response contains `content: [{ type: "text", text: <JSON string> }]` and `isError` is absent or `false`

**Given** `tools/call` is invoked with a tool name that does not exist in the manifest
**When** the call completes
**Then** the response contains `isError: true` and the text matches `"Unknown tool: {name}. Available groups: {groupList}"`

**Given** `src/index.ts` is reviewed after wiring
**When** checking line count and tool registration pattern
**Then** `src/index.ts` is under 50 lines; tool registration is solely via `registerAllTools(server, client)` — no individual `server.tool()` calls in the entry point

**Given** `npm test` is run
**When** the smoke test suite executes
**Then** `test/smoke/mcp-protocol.test.ts` passes: `tools/list` count ≥ 1 and `tools/call` round-trip succeeds with fetch mock

### Story 1.6: CI Workflows & npm Publishing Configuration

As a contributor to operaton-mcp,
I want CI that runs automatically on every push and a complete npm publishing configuration,
So that quality is enforced continuously and the package is installable via `npx operaton-mcp`.

**Acceptance Criteria:**

**Given** a push is made to any branch or PR
**When** `.github/workflows/ci.yml` runs
**Then** it executes build + unit tests + smoke test; no secrets are required; the workflow completes without a live Operaton instance

**Given** a push is made to the `main` branch
**When** `.github/workflows/integration.yml` triggers
**Then** integration tests run using the `OPERATON_BASE_URL` repository secret; the workflow does not trigger on fork PRs

**Given** `package.json` is reviewed
**When** checking the `bin`, `files`, and `scripts` fields
**Then** `"bin": { "operaton-mcp": "./dist/index.js" }` is present; `"files": ["dist/", "README.md"]` excludes `src/`, `test/`, `scripts/`, `config/`, `resources/`; `"prepare"` script runs `npm run generate`

**Given** `README.md` is reviewed
**When** checking section coverage
**Then** all 5 required sections are present: Install & Run, Environment Variables (5-var table with `OPERATON_SKIP_HEALTH_CHECK` dev/test note), MCP Client Configuration (Claude Desktop example), Available Tool Groups, Development

**Given** an automated test invokes the `npx operaton-mcp` binary as a child process with `OPERATON_SKIP_HEALTH_CHECK=true` and valid env vars
**When** the binary executes and an MCP `initialize` handshake is sent
**Then** the server responds with a valid MCP `initialize` response and does not exit; this test is included in the CI smoke suite and requires no live Operaton instance

---

## Epic 2: Process Definition & Deployment Management

Users can deploy, discover, inspect, and remove process definitions via AI. Complete coverage of the process definition domain.

### Story 2.1: Deploy Process Definitions

As an engineer or operator using operaton-mcp,
I want to deploy a BPMN artifact to Operaton via AI,
So that I can publish new or updated process definitions without leaving my AI client or consulting the API docs.

**Acceptance Criteria:**

**Given** the processDefinition manifest group is populated with real BPM-domain descriptions and `frMapping` entries for FR-01 to FR-04, and `npm run generate` is run
**When** `tools/list` is called
**Then** processDefinition tools appear in the list; all have descriptions ≤ 200 characters using BPM-domain terminology appropriate for an operator audience (not generic REST descriptions); `frMapping` covers FR-01 through FR-04

**Given** a valid BPMN file is submitted via the deploy tool (FR-01)
**When** the tool call completes
**Then** the response contains the deployment ID and process definition key

**Given** an invalid BPMN artifact is submitted
**When** the tool call completes
**Then** `isError: true` is returned with a structured error containing the error type, cause, and a suggested corrective action

**Given** the integration test for FR-01 runs against a live Operaton instance
**When** `npm run test:integration` executes
**Then** the test passes; any deployed artifacts are cleaned up in `afterEach`

### Story 2.2: List and Retrieve Process Definitions

As an operator using operaton-mcp,
I want to list deployed process definitions with optional filters and retrieve the full BPMN XML of any definition,
So that I can audit what is deployed and inspect process logic without navigating Cockpit.

**Acceptance Criteria:**

**Given** a list query is made with no filters (FR-02)
**When** the tool call completes
**Then** all deployed definitions are returned; each result includes definition ID, key, name, version, and deployment ID

**Given** a list query is made filtered by key and version
**When** the tool call completes
**Then** only matching definitions are returned

**Given** a get-by-ID or get-by-key call is made for an existing definition (FR-03)
**When** the tool call completes
**Then** the response includes definition metadata and the BPMN/DMN XML

**Given** a get call is made for a non-existent definition ID
**When** the tool call completes
**Then** `isError: true` is returned with a structured not-found error

**Given** the integration tests for FR-02 and FR-03 run
**When** `npm run test:integration` executes
**Then** all tests pass

### Story 2.3: Delete Process Definitions

As an operator using operaton-mcp,
I want to delete a process definition by ID and receive explicit confirmation or a clear error if deletion is blocked,
So that I can clean up unused definitions safely through AI without silent partial operations.

**Acceptance Criteria:**

**Given** a delete call is made for a process definition with no active instances (FR-04)
**When** the tool call completes
**Then** the response confirms successful deletion

**Given** a delete call is made for a process definition with active instances
**When** the tool call completes
**Then** `isError: true` is returned with an error message identifying that active instances exist and suggesting resolution steps

**Given** a delete call is made for a non-existent definition ID
**When** the tool call completes
**Then** `isError: true` is returned with a structured not-found error

**Given** the integration test for FR-04 runs
**When** `npm run test:integration` executes
**Then** the test passes; any created artifacts are cleaned up in `afterEach`

---

## Epic 3: Process Instance Lifecycle Control

Users can start process instances, query running instances, control instance state, and read/write instance variables.

### Story 3.1: Start and Delete Process Instances

As an operator using operaton-mcp,
I want to start a new process instance from a deployed definition and delete instances that are no longer needed,
So that I can initiate and clean up workflow execution through AI conversation.

**Acceptance Criteria:**

**Given** the processInstance manifest group is populated with real BPM-domain descriptions and `frMapping` for FR-05 to FR-10, and `npm run generate` is run
**When** `tools/list` is called
**Then** processInstance tools appear in the list with descriptions ≤ 200 chars using BPM-domain terminology appropriate for an operator audience; `frMapping` covers FR-05 through FR-10

**Given** a start call is made with a valid process definition key, optional initial variables, and a business key (FR-05)
**When** the tool call completes
**Then** the response contains the instance ID, definition key, and current state

**Given** a start call references a process definition key that does not exist
**When** the tool call completes
**Then** `isError: true` is returned with a structured error identifying the unknown definition key

**Given** a delete call is made for an existing instance with an optional reason (FR-09)
**When** the tool call completes
**Then** the response confirms deletion; the reason is recorded if supplied

**Given** the integration tests for FR-05 and FR-09 run
**When** `npm run test:integration` executes
**Then** all tests pass; started instances are cleaned up in `afterEach`

### Story 3.2: Query Active Process Instances

As an operator using operaton-mcp,
I want to query running process instances using rich filters,
So that I can quickly identify instances matching specific criteria — such as those with incidents or in a suspended state — without navigating Cockpit.

**Acceptance Criteria:**

**Given** a query is made with no filters (FR-06)
**When** the tool call completes
**Then** all active instances are returned; each result includes instance ID, definition key, business key, start time, and state

**Given** a query is filtered by definition key and business key
**When** the tool call completes
**Then** only instances matching both criteria are returned

**Given** a query is filtered by incident presence (`incidentType` set)
**When** the tool call completes
**Then** only instances with matching incidents are returned

**Given** a query is filtered by suspension state
**When** the tool call completes
**Then** only instances in the specified suspension state are returned

**Given** the integration test for FR-06 runs
**When** `npm run test:integration` executes
**Then** the test passes

### Story 3.3: Suspend and Resume Process Instances

As an operator using operaton-mcp,
I want to suspend active instances to pause processing and resume suspended instances to continue them,
So that I can contain production issues and recover instances through AI conversation without manual API calls.

**Acceptance Criteria:**

**Given** a suspend call is made for an active instance (FR-07)
**When** the tool call completes
**Then** the response confirms the instance is now suspended

**Given** a suspend call is made for an instance that is already suspended or in a non-suspendable state
**When** the tool call completes
**Then** `isError: true` is returned with a structured error describing the state conflict

**Given** a resume call is made for a suspended instance (FR-08)
**When** the tool call completes
**Then** the response confirms the instance is now active

**Given** a resume call is made for an instance that is not suspended
**When** the tool call completes
**Then** `isError: true` is returned with a structured error

**Given** the integration tests for FR-07 and FR-08 run
**When** `npm run test:integration` executes
**Then** all tests pass; `afterEach` resumes any suspended instances and deletes any instances created during the test — no suspended or orphaned instances remain after the suite

### Story 3.4: Read and Write Process Instance Variables

As an operator using operaton-mcp,
I want to read the current variables of a process instance and update them when needed,
So that I can inspect and correct process state through AI without direct API calls.

**Acceptance Criteria:**

**Given** a read-variables call is made for an existing process instance (FR-10 read)
**When** the tool call completes
**Then** the response lists all variables with name, type, and value for each

**Given** a write-variables call is made with a valid variable map for an existing instance (FR-10 write)
**When** the tool call completes
**Then** the response confirms the variables were set

**Given** a write-variables call targets an instance that does not exist
**When** the tool call completes
**Then** `isError: true` is returned with a structured not-found error

**Given** the integration tests for FR-10 run
**When** `npm run test:integration` executes
**Then** all tests pass; any variable changes are cleaned up in `afterEach`

---

## Epic 4: Task Management

Users can query user tasks across the engine and take full lifecycle actions — claim, unclaim, complete, delegate — with support for task-local variables.

### Story 4.1: Query User Tasks

As an operator using operaton-mcp,
I want to query user tasks with rich filters,
So that I can identify task backlogs, overdue items, and unassigned work through AI without opening Tasklist.

**Acceptance Criteria:**

**Given** the task manifest group is populated with real BPM-domain descriptions and `frMapping` for FR-11 to FR-16, and `npm run generate` is run
**When** `tools/list` is called
**Then** task tools appear in the list with descriptions ≤ 200 chars using BPM-domain terminology appropriate for an operator audience; `frMapping` covers FR-11 through FR-16

**Given** a query is made with no filters (FR-11)
**When** the tool call completes
**Then** all user tasks are returned; each result includes task ID, name, assignee, candidate groups, priority, due date, and process instance ID

**Given** a query is filtered by assignee, candidate group, process instance ID, task definition key, and due date
**When** the tool call completes
**Then** only tasks matching all supplied filters are returned

**Given** the integration test for FR-11 runs
**When** `npm run test:integration` executes
**Then** the test passes

### Story 4.2: Claim, Unclaim, and Delegate Tasks

As an operator using operaton-mcp,
I want to claim tasks for a specific user, release claimed tasks, and delegate tasks to other users,
So that I can manage task assignment through AI in operational scenarios without the Tasklist UI.

**Acceptance Criteria:**

**Given** a claim call is made with a valid task ID and assignee (FR-12)
**When** the tool call completes
**Then** the response confirms the task is claimed by the specified assignee

**Given** a claim call is made for a task that is already claimed by another user
**When** the tool call completes
**Then** `isError: true` is returned with a structured error identifying the conflict

**Given** an unclaim call is made for a claimed task (FR-13)
**When** the tool call completes
**Then** the response confirms the task is unclaimed

**Given** a delegate call is made to transfer a task to another user (FR-15)
**When** the tool call completes
**Then** the response confirms the delegation

**Given** a delegate call references a non-existent task ID
**When** the tool call completes
**Then** `isError: true` is returned with a structured not-found error

**Given** the integration tests for FR-12, FR-13, and FR-15 run
**When** `npm run test:integration` executes
**Then** all tests pass; task state is cleaned up in `afterEach`

### Story 4.3: Complete Tasks and Set Task Variables

As an operator using operaton-mcp,
I want to complete user tasks with optional output variables and set task-local variables on in-progress tasks,
So that I can drive process execution forward through AI without manual form submission.

**Acceptance Criteria:**

**Given** a complete call is made for a valid task ID with optional completion variables (FR-14)
**When** the tool call completes
**Then** the response confirms completion; the process instance advances to the next step

**Given** a complete call is made for a task that cannot be completed (e.g., not assigned, wrong state)
**When** the tool call completes
**Then** `isError: true` is returned with a structured error describing why completion failed

**Given** a set-task-variables call is made with a valid variable map for an in-progress task (FR-16)
**When** the tool call completes
**Then** the response confirms the task-local variables were set

**Given** a set-task-variables call targets a non-existent task ID
**When** the tool call completes
**Then** `isError: true` is returned with a structured not-found error

**Given** the integration tests for FR-14 and FR-16 run
**When** `npm run test:integration` executes
**Then** all tests pass; completed tasks and created process instances are cleaned up in `afterEach`

---

## Epic 5: Job & Incident Operations

Users can query and control job execution and manage incidents — the core tools for production incident response.

### Story 5.1: Query Jobs and Trigger Immediate Execution

As an operator using operaton-mcp,
I want to query jobs with filters and trigger immediate execution of a specific job,
So that I can inspect job state and manually force execution of stuck or scheduled jobs through AI.

**Acceptance Criteria:**

**Given** the job, jobDefinition, and incident manifest groups are populated with real BPM-domain descriptions and `frMapping` for FR-17 to FR-23, and `npm run generate` is run
**When** `tools/list` is called
**Then** job and incident tools appear in the list with descriptions ≤ 200 chars using BPM-domain terminology appropriate for an operator audience; `frMapping` covers FR-17 through FR-23

**Given** a query-jobs call is made with no filters (FR-17)
**When** the tool call completes
**Then** all jobs are returned; each result includes job ID, type, retries, due date, and exception message if present

**Given** a query-jobs call is filtered by process instance ID, exception presence, and retries remaining
**When** the tool call completes
**Then** only jobs matching all supplied filters are returned

**Given** a trigger-execution call is made for a valid job ID (FR-18)
**When** the tool call completes
**Then** the response confirms execution triggered, or returns the exception message if the job fails during execution

**Given** the integration tests for FR-17 and FR-18 run
**When** `npm run test:integration` executes
**Then** all tests pass; any triggered jobs are cleaned up in `afterEach`

### Story 5.2: Suspend, Resume, and Retry Jobs

As an operator using operaton-mcp,
I want to suspend jobs to prevent further execution, resume them when ready, and adjust retry counts on failed jobs,
So that I can contain and recover from job failures through AI conversation during production incidents.

**Acceptance Criteria:**

**Given** a suspend call is made for a job by job ID (FR-19)
**When** the tool call completes
**Then** the response confirms the job is suspended

**Given** a suspend call is made targeting all jobs for a job definition by job definition ID (FR-19)
**When** the tool call completes
**Then** the response confirms all matching jobs are suspended

**Given** a resume call is made for a suspended job by job ID (FR-20)
**When** the tool call completes
**Then** the response confirms the job is resumed

**Given** a set-retries call is made for a job ID with a specific retry count (FR-21)
**When** the tool call completes
**Then** the response confirms the retry count is updated

**Given** a set-retries call targets a non-existent job ID
**When** the tool call completes
**Then** `isError: true` is returned with a structured not-found error

**Given** the integration tests for FR-19, FR-20, and FR-21 run
**When** `npm run test:integration` executes
**Then** all tests pass; `afterEach` resumes any suspended jobs, restores original retry counts, and deletes any job definitions created during the test — no suspended or modified jobs remain after the suite

### Story 5.3: Query and Resolve Incidents

As an operator using operaton-mcp,
I want to query incidents with filters and resolve specific incidents by ID,
So that I can identify and clear blocking incidents through AI without navigating Cockpit's incident management screens.

**Acceptance Criteria:**

**Given** a query-incidents call is made with no filters (FR-22)
**When** the tool call completes
**Then** all incidents are returned; each result includes incident ID, type, message, activity ID, and affected process instance ID

**Given** a query-incidents call is filtered by process instance ID, incident type, and activity ID
**When** the tool call completes
**Then** only incidents matching all supplied filters are returned

**Given** a resolve call is made for a valid incident ID (FR-23)
**When** the tool call completes
**Then** the response confirms the incident is resolved

**Given** a resolve call is made for an incident that cannot be resolved in its current state
**When** the tool call completes
**Then** `isError: true` is returned with a structured error describing the constraint

**Given** the integration tests for FR-22 and FR-23 run
**When** `npm run test:integration` executes
**Then** all tests pass; created incidents are cleaned up in `afterEach`

---

## Epic 6: User & Group Administration

Administrators can create, update, delete, and query Operaton user accounts and manage group memberships.

### Story 6.1: Create, Update, and Delete Operaton Users

As an administrator using operaton-mcp,
I want to create new Operaton user accounts, update existing profiles and passwords, and delete accounts no longer needed,
So that I can manage the Operaton user landscape through AI without requiring Cockpit admin access.

**Acceptance Criteria:**

**Given** the user and group manifest groups are populated with real BPM-domain descriptions and `frMapping` for FR-24 to FR-29, and `npm run generate` is run
**When** `tools/list` is called
**Then** user and group tools appear in the list with descriptions ≤ 200 chars using BPM-domain terminology appropriate for an administrator audience; `frMapping` covers FR-24 through FR-29

**Given** a create-user call is made with a unique ID, first name, last name, email, and password (FR-24)
**When** the tool call completes
**Then** the response confirms the user account was created

**Given** a create-user call uses an ID that already exists
**When** the tool call completes
**Then** `isError: true` is returned with a structured error identifying the ID conflict

**Given** an update-user call is made to change a user's profile or password (FR-25)
**When** the tool call completes
**Then** the response confirms the update

**Given** a delete-user call is made for an existing user ID (FR-26)
**When** the tool call completes
**Then** the response confirms deletion

**Given** a delete-user call targets a user ID that does not exist
**When** the tool call completes
**Then** `isError: true` is returned with a structured not-found error

**Given** the integration tests for FR-24, FR-25, and FR-26 run
**When** `npm run test:integration` executes
**Then** all tests pass; test runs against `test/integration/user.test.ts`; created users are deleted in `afterEach`

### Story 6.2: Query Users and Manage Groups

As an administrator using operaton-mcp,
I want to query Operaton users by profile attributes, create and delete groups, and manage group membership,
So that I can perform full user and group administration through AI in a single conversation.

**Acceptance Criteria:**

**Given** a query-users call is made filtered by ID, first name, last name, or email (FR-27)
**When** the tool call completes
**Then** a structured list of matching users is returned

**Given** a create-group call is made with a group ID and name (FR-28)
**When** the tool call completes
**Then** the response confirms the group was created

**Given** a delete-group call is made for an existing group ID (FR-28)
**When** the tool call completes
**Then** the response confirms deletion; a structured error is returned if the group does not exist

**Given** an add-member call is made with a valid user ID and group ID (FR-29)
**When** the tool call completes
**Then** the response confirms the user was added to the group

**Given** a remove-member call is made for a user/group pair where the user is not a member
**When** the tool call completes
**Then** `isError: true` is returned with a structured error

**Given** the integration tests for FR-27, FR-28, and FR-29 run
**When** `npm run test:integration` executes
**Then** all tests pass; test runs against `test/integration/group.test.ts`; created groups and group memberships are deleted in `afterEach`

---

## Epic 7: Historic Data & Audit

Teams can query historical process instances, activity instances, task completions, and variable history.

### Story 7.1: Query Historic Process and Activity Instances

As an operator using operaton-mcp,
I want to query completed and running process instances from history and retrieve their activity instance detail,
So that I can diagnose past failures and audit process execution paths through AI.

**Acceptance Criteria:**

**Given** the history manifest group is populated with real BPM-domain descriptions and `frMapping` for FR-30 to FR-33, and `npm run generate` is run
**When** `tools/list` is called
**Then** history tools appear in the list with descriptions ≤ 200 chars using BPM-domain terminology appropriate for an operator/analyst audience; `frMapping` covers FR-30 through FR-33

**Given** a query-historic-instances call is made filtered by process definition key, business key, and start/end date range (FR-30)
**When** the tool call completes
**Then** matching historic instances are returned; each includes instance ID, definition key, business key, start time, end time, duration, and state

**Given** a query-historic-instances call is filtered by completion state
**When** the tool call completes
**Then** only instances in the specified state (completed, active, etc.) are returned

**Given** a query-activity-instances call is made for a process instance ID (FR-31)
**When** the tool call completes
**Then** all activity instances are returned; each includes activity ID, name, type, start time, end time, assignee (for user tasks), and duration

**Given** the integration tests for FR-30 and FR-31 run
**When** `npm run test:integration` executes
**Then** all tests pass

### Story 7.2: Query Historic Tasks and Variables

As an operator using operaton-mcp,
I want to query historic task instances and the variable history for a process instance,
So that I can reconstruct the complete execution record of a process through AI for audit and debugging purposes.

**Acceptance Criteria:**

**Given** a query-historic-tasks call is made filtered by process instance ID and task definition key (FR-32)
**When** the tool call completes
**Then** matching historic tasks are returned; each includes task name, assignee, completion time, and duration

**Given** a query-historic-variables call is made for a process instance ID (FR-33)
**When** the tool call completes
**Then** all historic variable instances are returned; each includes variable name, type, value, and the activity instance in which it was set

**Given** a historic query targets a process instance ID that has no history records
**When** the tool call completes
**Then** an empty list is returned (not an error)

**Given** the integration tests for FR-32 and FR-33 run
**When** `npm run test:integration` executes
**Then** all tests pass

---

## Epic 8: Decision & DMN Management

Users can deploy DMN decision tables and evaluate deployed decisions, completing the full Operaton capability surface.

### Story 8.1: Deploy and Evaluate DMN Decisions

As an operator or analyst using operaton-mcp,
I want to deploy DMN decision tables to Operaton and evaluate them with input variables,
So that I can manage and test decision logic through AI alongside BPMN process management.

**Acceptance Criteria:**

**Given** the decision and decisionRequirements manifest groups are populated with real BPM-domain descriptions and `frMapping` for FR-34 and FR-35, and `npm run generate` is run
**When** `tools/list` is called
**Then** decision tools appear in the list with descriptions ≤ 200 chars using BPM-domain terminology appropriate for an operator/analyst audience; `frMapping` covers FR-34 and FR-35

**Given** a valid DMN artifact is submitted via the deploy-decision tool (FR-34)
**When** the tool call completes
**Then** the response contains the decision definition key and deployment ID

**Given** an invalid DMN artifact is submitted
**When** the tool call completes
**Then** `isError: true` is returned with a structured error containing the error type, cause, and a suggested corrective action

**Given** an evaluate-decision call is made with a valid decision definition key and correct input variables (FR-35)
**When** the tool call completes
**Then** the response contains the structured evaluation result

**Given** an evaluate-decision call is made with input variables that fail decision evaluation
**When** the tool call completes
**Then** `isError: true` is returned with a structured error describing the evaluation failure

**Given** the integration tests for FR-34 and FR-35 run
**When** `npm run test:integration` executes
**Then** all tests pass; deployed DMN artifacts are cleaned up in `afterEach`

---

## Epic 9: OSS Project Standards & Release Automation

operaton-mcp meets open-source project standards: all source files carry the Operaton Apache 2.0 license header, contributors have clear guidance in CONTRIBUTING.md, a SECURITY.md documents the vulnerability reporting policy, CI enforces license headers and conventional commit format, and the project can publish NPM releases and GitHub Releases via a JReleaser-backed release workflow with preliminary/final/dry-run modes. The README documents all tool groups and their operations along with an explicit out-of-scope section.

### Story 9.1: License Headers on Source Files

As a maintainer of operaton-mcp,
I want all TypeScript source files in `src/`, `test/`, and `scripts/` to carry the Operaton Apache 2.0 license header,
So that the project meets open-source licensing requirements and CI rejects PRs that omit required headers.

**Acceptance Criteria:**

**Given** `npm run check:license` is run on the repository
**When** all `.ts` files in `src/`, `test/`, and `scripts/` carry the correct 14-line Operaton Apache 2.0 `//`-comment header
**Then** the command exits zero with no files reported

**Given** `npm run check:license` is run on the repository
**When** any `.ts` file in `src/`, `test/`, or `scripts/` is missing the license header
**Then** the command exits non-zero and prints the offending file paths

**Given** the code generator emits a new `.ts` file
**When** that file is committed
**Then** the license header is prepended as the first lines of the file

---

### Story 9.2: CONTRIBUTING.md

As a contributor to operaton-mcp,
I want a CONTRIBUTING.md that explains the contributor workflow, conventional commit scopes, and license requirements,
So that I can contribute confidently without needing to ask maintainers for guidance.

**Acceptance Criteria:**

**Given** `CONTRIBUTING.md` exists at the project root
**When** it is reviewed
**Then** it contains: (1) the Operaton license header verbatim inside an HTML comment at the top, (2) a Getting Started section, (3) a Development section with build/test commands, (4) a Commit Conventions section with the 12 defined scopes and ≥ 4 examples, a link to conventionalcommits.org, and (5) a PR guide

**Given** the Commit Conventions section is reviewed
**When** checking the scope list
**Then** all 12 scopes are present: `process`, `task`, `job`, `incident`, `history`, `decision`, `user`, `deploy`, `config`, `ci`, `docs`, `test`

---

### Story 9.3: SECURITY.md

As a security researcher or user of operaton-mcp,
I want a SECURITY.md that tells me how to report vulnerabilities and what the response process is,
So that I can disclose security issues responsibly without needing to find maintainer contact details.

**Acceptance Criteria:**

**Given** `SECURITY.md` exists at the project root
**When** it is reviewed
**Then** it contains sections for: Supported Versions, Reporting a Vulnerability (via GitHub Security Advisories), Response Process, Scope, and Legal — modelled on `operaton/operaton`

**Given** the Reporting section is reviewed
**When** checking the advisory link
**Then** it points to `https://github.com/operaton/operaton-mcp/security/advisories/new`

---

### Story 9.4: CI Enhancements — License Check & Commitlint

As a maintainer of operaton-mcp,
I want the CI workflow to automatically enforce license headers and conventional commit format on every PR,
So that contributors receive immediate feedback when their contribution is missing required headers or uses a non-conforming commit message.

**Acceptance Criteria:**

**Given** a PR is opened with a `.ts` file missing the license header
**When** CI runs
**Then** the `check-license` step fails and prints offending file paths; the workflow exits non-zero

**Given** a PR is opened with a commit message not conforming to conventional commits (e.g., `"fixed stuff"`)
**When** CI runs
**Then** the `commitlint` step fails identifying the non-conforming commit

**Given** `.nvmrc` exists at the project root
**When** `.github/workflows/ci.yml` sets up Node.js
**Then** it reads the version from `.nvmrc` via `node-version-file: .nvmrc` rather than a hardcoded version string

**Given** `.commitlintrc.json` exists
**When** commitlint runs
**Then** it enforces conventional commit format with the 12 defined scopes, with scope optional (scope-empty disabled)

---

### Story 9.5: JReleaser Configuration

As a maintainer of operaton-mcp,
I want a JReleaser configuration that defines how the NPM package and GitHub Release are produced,
So that the release process is declarative, repeatable, and generates changelogs automatically from conventional commits.

**Acceptance Criteria:**

**Given** `jreleaser.yml` exists at the project root
**When** `jreleaser full-release --dry-run` is executed
**Then** JReleaser reports it would publish an NPM distribution and create a GitHub Release with a conventional-commits changelog — with no external mutations

**Given** `jreleaser.yml` is reviewed
**When** checking credential references
**Then** all credentials are referenced via environment variable placeholders, never hardcoded

**Given** `package.json` is reviewed
**When** checking the `engines` field
**Then** it declares `"node": ">=22.0.0"` consistent with `.nvmrc`

---

### Story 9.6: Release Workflow

As a maintainer of operaton-mcp,
I want a GitHub Actions release workflow that supports preliminary (SNAPSHOT) and final releases with a dry-run mode,
So that I can publish pre-releases for community testing and cut stable releases with auto-generated changelogs — safely and repeatably.

**Acceptance Criteria:**

**Given** `.github/workflows/release.yml` is reviewed
**When** checking the workflow inputs
**Then** it declares `release_type` (choice: `preliminary` | `final`, required) and `dry_run` (boolean, default `false`)

**Given** the workflow runs with `release_type=preliminary` and `dry_run=false`
**When** it completes
**Then** the NPM package is published with version `x.y.z-SNAPSHOT` to the `next` dist-tag and a GitHub pre-release is created

**Given** the workflow runs with `release_type=final` and `dry_run=false`
**When** it completes
**Then** a semver git tag is created, NPM package is published to `latest` with `--provenance`, a GitHub Release is created, and a version bump commit (`x.(y+1).0-SNAPSHOT`) is pushed to `main`

**Given** the workflow runs with `dry_run=true`
**When** it completes
**Then** no NPM publish, no GitHub Release, no git tags, and no version bump commit occur; workflow log shows what would have happened

**Given** the release workflow is reviewed
**When** checking job permissions
**Then** it declares `contents: write` and `id-token: write`

---

### Story 9.7: README Tool Groups & Out-of-Scope Section

As a user evaluating or setting up operaton-mcp,
I want the README to show me exactly which tool groups are available and what is explicitly not supported,
So that I can quickly determine whether operaton-mcp meets my needs.

**Acceptance Criteria:**

**Given** `README.md` is reviewed
**When** checking the Available Tool Groups section
**Then** it lists all 9 MCP tool groups (`processDefinition`, `deployment`, `processInstance`, `task`, `job`, `incident`, `user`, `history`, `decision`), each with a one-line description and bullet list of key operations

**Given** `README.md` is reviewed
**When** checking for an out-of-scope section
**Then** it contains an explicit "Out of Scope" section listing at minimum: autonomous monitoring, BPMN generation, multi-engine support, UI or dashboard, and prompt templates — with references to Growth/Vision phases

**Given** `README.md` is reviewed
**When** checking the original sections from Story 1.6
**Then** all 5 original sections (Install & Run, Environment Variables, MCP Client Configuration, Available Tool Groups, Development) are still present and unchanged in content

---

## Epic 10: Authentication & Multi-Engine Support

**Goal:** Extend operaton-mcp to support OIDC client credentials authentication alongside existing Basic Auth, and allow multiple named Operaton engine endpoints to be configured — with full backward compatibility for existing single-engine env-var configurations.

**Stories:**

### Story 10.1: Config Schema — Multi-Engine & Auth Type Discriminator

As an engineer deploying operaton-mcp,
I want to configure one or more Operaton engines with either Basic Auth or OIDC client credentials,
so that the server connects to the right engine with the right authentication strategy at startup.

**Key Acceptance Criteria:**
- Legacy `OPERATON_BASE_URL` + `OPERATON_USERNAME` + `OPERATON_PASSWORD` env vars continue to work unchanged (zero migration)
- New env vars `OPERATON_CLIENT_ID`, `OPERATON_CLIENT_SECRET`, `OPERATON_TOKEN_URL` enable OIDC single-engine mode
- `OPERATON_CONFIG` env var points to a JSON config file enabling multi-engine mode
- Config file supports named engines with `authentication.type: "basic" | "oidc"` discriminator
- Multi-engine config requires exactly one engine with `"default": true`; startup fails fast with clear error if ambiguous

### Story 10.2: OIDC Token Manager

As an engineer using operaton-mcp with an OIDC-secured Operaton instance,
I want the server to automatically obtain and refresh bearer tokens using client credentials,
so that API calls are authenticated transparently without manual token management.

**Key Acceptance Criteria:**
- Fetches token on first use (lazy), caches with expiry from `expires_in`
- Proactively refreshes 30 seconds before expiry
- Handles concurrent requests safely (no thundering herd)
- Structured error messages on token fetch failure

### Story 10.3: Multi-Engine HTTP Client & Connectivity

As a developer using operaton-mcp,
I want the HTTP client to route requests to the correct Operaton engine using the appropriate auth strategy,
so that all tool calls are authenticated correctly without any per-tool changes.

**Key Acceptance Criteria:**
- Basic auth engines use `Authorization: Basic` header
- OIDC engines call TokenManager and use `Authorization: Bearer` header
- Default engine selected automatically; `defaultEngine` used for all tool calls
- Startup connectivity check works with both auth types

### Story 10.4: Auth & Multi-Engine Integration Tests

As a developer maintaining operaton-mcp,
I want automated integration tests covering all authentication modes and multi-engine config,
so that regressions in auth behavior are caught before release.

**Key Acceptance Criteria:**
- Mock OIDC token endpoint (using `msw`) — no real external services in CI
- Tests for: basic auth, OIDC auth, token refresh, OIDC error handling, multi-engine config
- Legacy env-var config regression test

---

## Epic 11: Professional Documentation & Project Health

**Goal:** Elevate operaton-mcp to a professionally documented open source project with a polished README, a comprehensive configuration guide, GitHub community health files (issue templates, PR template), and correct project metadata — giving first-time visitors an immediate impression of quality.

**Stories:**

### Story 11.1: README Overhaul

As a developer discovering operaton-mcp on GitHub or npm,
I want a professional, well-structured README that immediately communicates what the project does and how to get started,
so that I can evaluate and adopt the project within minutes.

**Key Acceptance Criteria:**
- Badge row: npm version, CI status, license, Node.js compatibility
- Complete Quick Start Claude Desktop config snippet (copy-pasteable)
- Authentication section covers both Basic Auth and OIDC with examples
- Links to `docs/configuration.md` for multi-engine setup

### Story 11.2: Configuration Guide

As a developer configuring operaton-mcp for a real deployment,
I want a dedicated configuration reference covering all scenarios,
so that I can configure the server correctly without reading source code.

**Key Acceptance Criteria:**
- `docs/configuration.md` with three annotated examples: basic auth env vars, OIDC env vars, multi-engine config file
- Complete environment variable reference table
- Security best practices callout (no hardcoded secrets, gitignore patterns)
- Troubleshooting section with common error messages

### Story 11.3: GitHub Community Files

As a contributor approaching operaton-mcp on GitHub,
I want well-structured issue templates and a PR template,
so that maintainers can triage efficiently.

**Key Acceptance Criteria:**
- `.github/ISSUE_TEMPLATE/bug_report.yml` — GitHub form-based template with structured fields
- `.github/ISSUE_TEMPLATE/feature_request.yml` — form-based template
- `.github/pull_request_template.md` — checklist-based PR template
- `CONTRIBUTING.md` updated to reference templates and PR process

### Story 11.4: GitHub Project Metadata & Repository Polish

As a developer discovering operaton-mcp via GitHub search,
I want a polished repository with accurate description, relevant topics, and correct npm metadata,
so that the project's quality and scope are immediately apparent.

**Key Acceptance Criteria:**
- `package.json` description, keywords, homepage, bugs, repository fields populated
- `CODE_OF_CONDUCT.md` added (Contributor Covenant 2.1)
- GitHub repository topics, description, website set (manual admin step documented)
- npm publish exclusions verified (`package.json#files` or `.npmignore`)
