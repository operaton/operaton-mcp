# Story 12.1: Migration Discovery

Status: review

## Story

As an operations engineer scripting a migration,
I want to discover which process instances are eligible for migration to a newer definition version,
so that I can build a precise, validated instance list before generating a migration plan.

## Acceptance Criteria

1. **Given** a process definition key is supplied to `processInstance_listMigratable` **When** the tool is called **Then** it returns a structured list of instances with per-instance eligibility status and any blocking conditions; instances with active call activities include a `callActivityBlocked: true` flag noting that child instances are outside migration scope.

2. **Given** filtering parameters are supplied (version range, state, business key pattern) **When** `processInstance_listMigratable` is called **Then** only instances matching all supplied filters appear in the results.

3. **Given** a source and target process definition ID pair are supplied to `processDefinition_getMigrationCandidates` **When** the tool is called **Then** it returns a structured breakdown of auto-mappable activity pairs versus activities requiring explicit mapping decisions.

4. **Given** `processDefinition_getMigrationCandidates` is called with an optional `requiredVariables` list **When** some instances are missing one or more required variable names **Then** those instances are flagged in the response with the missing variable names.

5. **Given** the `frMapping` field in the tool manifest **When** the manifest is reviewed **Then** `frMapping` covers FR-43 and FR-44 for the discovery tools.

6. **Given** the integration tests for FR-43 and FR-44 run against a live Operaton instance **When** all tests execute **Then** all pass; tests cover eligible instances, blocked instances (call activities), filtered subsets, and missing-variable flagging.

## Tasks / Subtasks

- [x] Implement `processInstance_listMigratable` tool (FR-43) (AC: 1, 2)
  - [x] Query active process instances by definition key using `GET /process-instance`
  - [x] Filter by optional `sourceVersion`, `stateIn`, `businessKeyLike` params
  - [x] For each instance, check active activity instances for call activities (`GET /process-instance/{id}/activity-instances`)
  - [x] Return structured list: `{ instances: [{ id, businessKey, definitionId, eligible, callActivityBlocked, blockingConditions }], totalCount }`
- [x] Implement `processDefinition_getMigrationCandidates` tool (FR-44) (AC: 3, 4)
  - [x] Fetch source definition XML via `GET /process-definition/{id}/xml`
  - [x] Fetch target definition XML via `GET /process-definition/{id}/xml`
  - [x] Parse activity IDs from both BPMN XMLs (regex extraction from `id="..."` attributes on flowElements)
  - [x] Classify: auto-mappable (same ID in both), unmapped source (only in source), new target (only in target)
  - [x] If `requiredVariables` supplied, check variable presence per instance using `GET /process-instance/{id}/variables`
  - [x] Return: `{ sourceDefinitionId, targetDefinitionId, autoMappable: [{sourceId, targetId}], unmappedSource: [id], newTarget: [id], instancesWithMissingVariables?: [{instanceId, missing:[]}] }`
- [x] Register both tools in `src/tools/index.ts` via `getCustomTools()`
- [x] Add frMapping comments (`// frMapping: FR-43` and `// frMapping: FR-44`)
- [x] Write unit tests for both tools (mock HTTP client)
- [x] Write integration tests (skipped when OPERATON_BASE_URL not set)

## Dev Notes

### Implementation Notes

- `processDefinition_getMigrationCandidates` is MCP-side logic: parse both BPMNs, diff activity IDs. No single Operaton endpoint covers this.
- Activity ID extraction from BPMN: match `id="..."` on elements that are BPMN flow nodes (not sequences, processes, etc.). Use: `/<bpmn:[a-zA-Z]+[^>]*\sid="([^"]+)"[^>]*>/g` excluding `definitions`, `process`, `collaboration`, `sequenceFlow`, `dataObject`.
- Call activity detection: `GET /process-instance/{id}/activity-instances` — look for activities with `activityType === "callActivity"` in the response.
- For `requiredVariables` check: use `GET /process-instance/{id}/variables` — check which required variable names are absent from the response.

### Key File Locations

- `src/tools/migration.ts` — all migration tools in one file
- `src/tools/index.ts` — register via `getCustomTools()`
- `test/unit/tools/migration.test.ts` — unit tests
- `test/integration/migration.test.ts` — integration tests

### References

- Story 12.2: uses candidates from this story's output as migration plan input
- Story 12.3: uses instance list from `processInstance_listMigratable`

## Dev Agent Record

### Implementation Summary

Implemented `processInstance_listMigratable` (FR-43) and `processDefinition_getMigrationCandidates` (FR-44) in `src/tools/migration.ts`. Both tools registered in `src/tools/index.ts`. BPMN activity ID extraction uses regex against a `MAPPABLE_ELEMENTS` Set to identify flow nodes. Call activity detection queries activity instance tree per instance. Unit and integration tests written and passing.

### Changes Made

- `src/tools/migration.ts` — new file: FR-43 and FR-44 tool implementations (plus all Epic 12 tools)
- `src/tools/index.ts` — registered both tools in `getCustomTools()`
- `test/unit/tools/migration.test.ts` — unit tests for both tools
- `test/integration/migration.test.ts` — integration tests for FR-43 and FR-44
