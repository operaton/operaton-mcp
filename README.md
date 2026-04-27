# operaton-mcp

> MCP server exposing the full Operaton BPMN/DMN REST API to AI assistants

[![npm version](https://img.shields.io/npm/v/@operaton/operaton-mcp)](https://www.npmjs.com/package/@operaton/operaton-mcp)
[![CI](https://github.com/operaton/operaton-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/operaton/operaton-mcp/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/node/v/@operaton/operaton-mcp)](https://nodejs.org)

[Operaton](https://operaton.org) is an open-source BPMN and DMN workflow engine. **operaton-mcp** is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes 300+ Operaton REST API operations as MCP tools, enabling AI assistants like Claude to interact directly with your workflow engine — deploying processes, managing instances, handling tasks, and querying history.

## Features

- **Full REST API coverage** — 300+ operations across process definitions, instances, tasks, jobs, incidents, users, history, and decisions
- **Multi-engine support** — connect to multiple Operaton instances from a single server
- **Basic Auth & OIDC** — supports both HTTP Basic authentication and OAuth2 client credentials (OIDC)
- **Access control guards** — configurable operation guards to restrict what the AI can do (`OPERATON_GUARD`, `OPERATON_DENY_RESOURCES`, `OPERATON_DENY_OPS`)
- **Zero-setup with npx** — run without installation via `npx operaton-mcp`
- **Type-safe** — written in TypeScript with strict type checking

## Quick Start

> **Prerequisites:** Node.js ≥ 22, a running Operaton instance.

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "operaton": {
      "command": "npx",
      "args": ["-y", "operaton-mcp"],
      "env": {
        "OPERATON_BASE_URL": "http://localhost:8080/engine-rest",
        "OPERATON_USERNAME": "demo",
        "OPERATON_PASSWORD": "demo"
      }
    }
  }
}
```

Restart Claude Desktop — you're ready to use natural-language commands against your Operaton instance.

## Authentication

### Basic Auth

| Variable | Required | Description |
|---|---|---|
| `OPERATON_BASE_URL` | Yes | Operaton REST API URL, e.g. `http://localhost:8080/engine-rest` |
| `OPERATON_USERNAME` | Yes | Basic Auth username |
| `OPERATON_PASSWORD` | Yes | Basic Auth password |
| `OPERATON_ENGINE` | No | Operaton engine name (default: `default`) |
| `OPERATON_SKIP_HEALTH_CHECK` | No | Set `true` to skip startup connectivity check |

### OIDC / Client Credentials

| Variable | Required | Description |
|---|---|---|
| `OPERATON_BASE_URL` | Yes | Operaton REST API URL |
| `OPERATON_CLIENT_ID` | Yes | OAuth2 client ID |
| `OPERATON_CLIENT_SECRET` | Yes | OAuth2 client secret |
| `OPERATON_TOKEN_URL` | Yes | Token endpoint URL |

```json
{
  "mcpServers": {
    "operaton": {
      "command": "npx",
      "args": ["-y", "operaton-mcp"],
      "env": {
        "OPERATON_BASE_URL": "https://operaton.example.com/engine-rest",
        "OPERATON_CLIENT_ID": "mcp-client",
        "OPERATON_CLIENT_SECRET": "your-secret",
        "OPERATON_TOKEN_URL": "https://keycloak.example.com/realms/myapp/protocol/openid-connect/token"
      }
    }
  }
}
```

> For multi-engine deployments, see the [Configuration Guide](docs/configuration.md).

## Access Control Guards

Guards let you constrain what the AI assistant is allowed to do. They are enforced at the MCP dispatch layer — blocked calls never reach Operaton.

### `OPERATON_GUARD` — overall mode

| Value | Effect |
|---|---|
| *(unset)* or `unrestricted` | All operations permitted (default) |
| `read-only` | Only read operations permitted; all mutating calls are blocked |
| `safe` | Read and reversible mutations permitted; irreversible operations (delete, deploy, migrate-execute) are blocked |

```json
"env": {
  "OPERATON_GUARD": "read-only"
}
```

### `OPERATON_DENY_RESOURCES` — block specific domains

Comma-separated list of resource domains to deny entirely. Both reads and writes in the named domain are blocked.

Valid domains: `process-definitions`, `deployments`, `instances`, `tasks`, `jobs`, `incidents`, `users-groups`, `decisions`, `migrations`, `infrastructure`

```json
"env": {
  "OPERATON_DENY_RESOURCES": "users-groups,decisions"
}
```

### `OPERATON_DENY_OPS` — block specific operation classes

Comma-separated list of operation classes to deny regardless of domain.

Valid classes: `read`, `create`, `update`, `delete`, `suspend-resume`, `deploy`, `migrate-execute`, `migrate-control`

```json
"env": {
  "OPERATON_DENY_OPS": "delete,deploy"
}
```

### Combining guards

All three env vars can be set together. The most restrictive rule that matches a call wins. Precedence: `OPERATON_GUARD` → `OPERATON_DENY_RESOURCES` → `OPERATON_DENY_OPS`.

When a call is blocked, the MCP client receives an `isError` response naming the blocked operation and the guard rule that triggered. The server logs a WARN entry with full detail including a remediation hint.

> **Production tip:** Use `OPERATON_GUARD=safe` to prevent the AI from accidentally deleting definitions or executing migrations while still allowing it to start instances, complete tasks, and manage jobs.

## Available Tools

### `processDefinition`

Manage deployed process definitions — browse, inspect, suspend, and delete BPMN definitions.

- **list** — query definitions with optional filters (key, name, version, tenant); count total matches
- **get by ID / key** — retrieve definition metadata for a specific ID or latest by key
- **get XML** — fetch BPMN 2.0 XML for a definition by ID or key
- **statistics** — process-level and activity-level statistics across all running instances
- **suspend by key** — suspend or resume all instances belonging to a definition
- **delete by ID / key** — remove a definition (and optionally its instances and history)
- **restart instances** — restart historic process instances synchronously or asynchronously
- **set history TTL** — update the history time-to-live for a definition
- **get called processes** — list static called process definitions for a given definition

### `deployment`

Deploy, inspect, and manage Operaton deployments (BPMN, DMN, CMMN, and form files).

- **create** — upload a BPMN/DMN/CMMN resource to create a new deployment
- **list** — query deployments with optional filters; count total matches
- **get by ID** — retrieve metadata for a specific deployment
- **list resources** — list all resources included in a deployment
- **redeploy** — create a new deployment from the resources of an existing one
- **delete** — remove a deployment by ID

### `processInstance`

Start and manage the lifecycle of running process instances.

- **start** — start a new instance by definition ID or key, with optional business key and variables
- **list** — query active instances with filters; count total matches
- **get** — retrieve metadata for a specific instance
- **get activity tree** — inspect the current activity instance hierarchy
- **suspend / resume** — suspend or resume execution of an instance or a group of instances
- **delete** — terminate and remove a process instance
- **get / set variables** — read or write individual or multiple process variables
- **set suspension** — bulk suspend/resume by definition ID, key, or tenant

### `task`

Query and manage the full lifecycle of user tasks.

- **list** — query tasks with rich filter criteria; count total matches
- **get** — retrieve a task by ID
- **claim / unclaim** — assign or release a task
- **complete** — complete a task with optional output variables
- **delegate** — delegate a task to another user
- **resolve** — resolve a delegated task back to the owner
- **set assignee** — directly set or change task assignee
- **create / update** — create a standalone task or update task properties
- **get / set variables** — read or write task-local variables
- **throw BPMN error** — trigger a BPMN error boundary event from a task

### `job`

Inspect and control asynchronous jobs (timers, async continuations, retries).

- **list** — query jobs with filters; count total matches
- **get** — retrieve a job by ID
- **trigger execution** — execute a job immediately (bypass timer)
- **suspend / resume** — suspend or resume a job
- **set retries** — update the retry count on a failed job
- **get stack trace** — retrieve the exception stack trace for a failed job

### `jobDefinition`

Manage job definitions — the templates from which individual jobs are created.

- **list** — query job definitions with filters
- **get** — retrieve a job definition by ID
- **set suspension** — suspend or activate job definitions by process definition

### `incident`

Query and resolve process incidents (failed jobs, failed external tasks, etc.).

- **list** — query open incidents with filters; count total matches
- **get** — retrieve an incident by ID
- **resolve** — resolve an open incident

### `user`

Manage Operaton users and their credentials.

- **list** — query users with filters
- **get profile** — retrieve a user's profile information
- **create** — create a new user with profile and credentials
- **update profile** — update a user's display name and email
- **update password** — change a user's password
- **delete** — remove a user
- **unlock** — unlock a user account after too many failed logins

### `group`

Manage Operaton groups and their memberships.

- **list** — query groups with filters
- **create / delete** — create or remove a group
- **add / remove member** — manage group membership

### `history`

Query the audit trail of completed and historic process data.

- **list process instances** — query finished or active process instances in history
- **list activity instances** — query historic activity executions
- **list task instances** — query historic task completions and assignments
- **list variable instances** — query historic variable values
- **list incidents** — query historic incidents (including resolved)
- **list job logs** — query historic job execution log entries
- **list user operations** — query the audit log of user operations (claims, completions, etc.)

### `decision`

Deploy and evaluate DMN decision tables.

- **list** — query deployed decision definitions
- **get by key** — retrieve a decision definition by key
- **get XML by key** — fetch DMN XML for a decision
- **evaluate** — evaluate a decision table with input variables
- **list requirements** — list decision requirement diagrams (DRDs)

### `migration`

Discover, plan, execute, monitor, and audit process instance migrations between definition versions.

- **listMigratable** (`processInstance_listMigratable`) — list active instances eligible for migration with per-instance eligibility and call-activity blocking conditions
- **getMigrationCandidates** (`processDefinition_getMigrationCandidates`) — compare source and target definition activities; returns auto-mappable pairs, unmapped source activities, and new target activities
- **generatePlan** (`migration_generatePlan`) — generate a migration plan with auto-mapped instructions and a list of unmapped activities requiring explicit mapping
- **validatePlan** (`migration_validatePlan`) — validate a migration plan against a set of instances; returns typed errors, sampled-validation flag, and consequence disclosure
- **executeBatch** (`migration_executeBatch`) — execute a migration plan asynchronously with auto-chunking; supports dry-run mode
- **suspendBatch** (`migration_suspendBatch`) — suspend one or more active migration batches
- **resumeBatch** (`migration_resumeBatch`) — resume one or more suspended migration batches
- **deleteBatch** (`migration_deleteBatch`) — cancel (delete) one or more migration batches
- **listBatches** (`migration_listBatches`) — list active migration batches, optionally filtered by suspended state
- **awaitBatch** (`migration_awaitBatch`) — poll migration batches until completion or timeout; returns aggregated progress
- **getBatchStatus** (`migration_getBatchStatus`) — get current job counts and suspension state for a single batch
- **getBatchFailures** (`migration_getBatchFailures`) — retrieve per-instance failure details including error messages and stack traces
- **retryFailedJobs** (`migration_retryFailedJobs`) — reset retries on all failed migration jobs in one or more batches
- **getBatchSummary** (`migration_getBatchSummary`) — aggregate post-migration summary across batch IDs: submitted, succeeded, failed, duration
- **listAuditEntries** (`migration_listAuditEntries`) — query the user operation log for migration audit entries with operator, timestamp, and definition filters
- **listHistoricBatches** (`migration_listHistoricBatches`) — query the history log for completed migration batches with date-range and completion-state filters

## Example Prompts

**Deployments & Definitions**
> "Deploy this BPMN file to Operaton and name it `loan-approval-v3`."
> "List all deployed versions of the `invoice-approval` process."
> "Show me the BPMN XML for the latest version of the `onboarding` process."

**Process Instances**
> "Start a new `invoice-approval` process with business key `INV-2024-001` and set the `amount` variable to 15000."
> "List all active instances of the `loan-approval` process."
> "What variables are currently set on process instance `abc-123`?"

**User Tasks**
> "Show me all unassigned tasks for the `approvers` group."
> "Claim task `task-456` for user `john.doe`."
> "Complete the approval task for invoice INV-2024-001 and set `approved = true`."

**Operations & Incidents**
> "Are there any failed jobs with no retries left?"
> "Reset the retry count to 3 for job `job-789` and trigger immediate execution."
> "List all open incidents for the `payment-processing` process."

**History & Audit**
> "Show me all completed `invoice-approval` instances from last week."
> "Who completed the approval task for business key `INV-2024-001`, and when?"

**Decisions**
> "Deploy this DMN decision table for loan eligibility checking."
> "Evaluate the `credit-check` decision with `income = 50000` and `creditScore = 720`."

## Development

```bash
# Install dependencies (triggers code generation automatically)
npm install

# Run code generation manually
npm run generate

# Build (generate + compile + alias rewrite)
npm run build

# Watch mode for local development
npm run dev

# Run all tests (unit + smoke)
npm test

# Run integration tests (requires live Operaton instance)
OPERATON_BASE_URL=http://localhost:8080/engine-rest \
OPERATON_USERNAME=demo \
OPERATON_PASSWORD=demo \
npm run test:integration
```

### Project Structure

```
src/
  index.ts          — MCP server entry point
  config.ts         — Configuration loading (env vars + config file)
  auth/
    token-manager.ts — OIDC client credentials token manager
  http/
    client.ts       — Operaton HTTP client (Basic + OIDC auth)
    errors.ts       — Error normalization with BPM-domain hints
  generated/        — Build artifact (gitignored); produced by npm run generate
  tools/            — Curated tool wrappers (hand-written)
config/
  tool-manifest.json         — Full curation manifest (name, description, frMapping per operationId)
  tool-manifest.fixture.json — Fixture for development/testing
resources/
  operaton-rest-api.json     — Authoritative OpenAPI 3.0.2 spec (never modify)
scripts/
  generate.ts       — Code generation pipeline
docs/
  configuration.md  — Full configuration reference
```

## Out of Scope

The following capabilities are not available in the current release:

- **Autonomous monitoring** — AI-initiated process health watching and alerting (planned: Vision phase)
- **BPMN generation** — natural language → BPMN authoring and AI-assisted process design (planned: Growth phase)
- **Prompt templates** — guided scenario workflows for common operational tasks (planned: Growth phase)
- **UI or dashboard** — no web interface; operaton-mcp is a pure MCP server

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute, commit conventions, and the PR process.

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.
