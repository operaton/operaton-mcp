# Story 12.2: Migration Plan Management

Status: review

## Story

As an operations engineer scripting a migration,
I want to generate and validate a migration plan — with full consequence disclosure for timers, external tasks, and activity cancellations — before executing any batch,
so that I can make an informed decision and abort safely if risks are unacceptable.

## Acceptance Criteria

1. **Given** a source and target process definition ID are supplied to `migration_generatePlan` **When** the tool is called **Then** it returns auto-generated activity mappings and a list of unmapped activities requiring explicit mapping decisions before the plan can be executed.

2. **Given** a migration plan and a full list of instance IDs are supplied to `migration_validatePlan` **When** the tool is called **Then** it returns typed validation errors (not raw Operaton API responses) and `sampledValidation: false`.

3. **Given** a subset of instance IDs is supplied to `migration_validatePlan` **When** the tool is called **Then** the response includes `sampledValidation: true` to signal that full validation was not performed.

4. **Given** instances have active timer events **When** `migration_validatePlan` is called **Then** the response includes `activeTimers[]` with per-activity warnings.

5. **Given** instances have open external tasks **When** `migration_validatePlan` is called **Then** the response includes `openExternalTasks[]` with worker ID and affected instance count.

6. **Given** migration instructions include activity cancellations **When** `migration_validatePlan` is called with those instructions **Then** the response includes `willCancelActiveInstances[]` with per-activity cancellation impact counts.

7. **Given** validation fails with typed errors **When** the response is returned **Then** each error includes `type`, `sourceActivity`, `targetActivity`, and a human-readable `message`; no raw Operaton HTTP bodies are surfaced.

8. **Given** the `frMapping` field in the tool manifest **When** the manifest is reviewed **Then** `frMapping` covers FR-45 and FR-46.

## Tasks / Subtasks

- [x] Implement `migration_generatePlan` tool (FR-45) (AC: 1)
  - [x] POST to `/engine/{engineName}/migration/generate` with `{ sourceProcessDefinitionId, targetProcessDefinitionId }`
  - [x] Extract `instructions` (auto-mappable) and identify `unmappedActivities` from the response
  - [x] Return: `{ plan: { sourceProcessDefinitionId, targetProcessDefinitionId, instructions }, unmappedActivities: [] }`
- [x] Implement `migration_validatePlan` tool (FR-46) (AC: 2–7)
  - [x] Accept `plan`, `instanceIds`, `instructions?` params
  - [x] Detect `sampledValidation`: compare `instanceIds.length` vs total active instances for that definition
  - [x] POST to `/engine/{engineName}/migration/validate` with plan + instanceIds + optional instructions
  - [x] Transform response into typed structure: `{ valid, sampledValidation, errors[], activeTimers[], openExternalTasks[], willCancelActiveInstances[] }`
  - [x] Map raw Operaton validation report to typed errors with `type`, `sourceActivity`, `targetActivity`, `message`
- [x] Register both tools in `src/tools/index.ts`
- [x] Write unit tests (mock HTTP client)
- [x] Write integration tests (skipped when OPERATON_BASE_URL not set)

## Dev Notes

### Implementation Notes

- `migration_generatePlan` wraps `POST /migration/generate`. The Operaton endpoint exists and auto-maps activities with matching IDs.
- `sampledValidation` detection: if the caller passes fewer instance IDs than total active instances for the source definition, set `sampledValidation: true`. Caller is responsible for unvalidated instances.
- The `activeTimers`, `openExternalTasks`, `willCancelActiveInstances` fields in the validate response come from interpreting Operaton's `MigrationPlanReportDto`. If the Operaton response body is a 200 with no failures, these arrays are empty.
- For consequence disclosure: query `GET /process-instance?processDefinitionId={sourceId}` to count total active instances for sampledValidation detection.

### Key File Locations

- `src/tools/migration.ts` — tool implementation
- `test/unit/tools/migration.test.ts` — unit tests
- `test/integration/migration.test.ts` — integration tests

## Dev Agent Record

### Implementation Summary

Implemented `migration_generatePlan` (FR-45) and `migration_validatePlan` (FR-46) in `src/tools/migration.ts`. `sampledValidation` detection queries total active instance count for the source definition and compares to supplied `instanceIds.length`. Typed error mapping normalizes raw Operaton validation report entries. Unit and integration tests written and passing.

### Changes Made

- `src/tools/migration.ts` — FR-45 and FR-46 implementations
- `src/tools/index.ts` — registered both tools
- `test/unit/tools/migration.test.ts` — unit tests
- `test/integration/migration.test.ts` — integration tests for FR-45 and FR-46
