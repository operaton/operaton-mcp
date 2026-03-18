# Story 12.5: Post-Migration Reporting & Audit

Status: review

## Story

As an operations engineer completing a migration,
I want a structured post-migration summary report and access to the Operaton audit log for migration operations,
so that I can produce a deployment sign-off record and investigate who ran which migration and when.

## Acceptance Criteria

1. **Given** batch IDs supplied to `migration_getBatchSummary` **When** called **Then** returns `{ sourceDefinitionId, targetDefinitionId, totalSubmitted, succeeded, failed, failureBreakdown: [{ errorType, count }], duration }` aggregated across all batch IDs.

2. **Given** a chunked migration produced multiple batch IDs **When** `migration_getBatchSummary` called with full array **Then** results aggregated into single report.

3. **Given** `migration_listAuditEntries` called without filters **When** called **Then** returns User Operation Log entries for migration operations including `operatorId`, `timestamp`, `operationType`, `sourceDefinitionId`, `targetDefinitionId`, `outcome`.

4. **Given** `migration_listAuditEntries` called with `processDefinitionKey` and `dateRange` filters **When** called **Then** only matching entries returned.

5. **Given** the README tool groups section reviewed after Epic 12 ships **When** checked **Then** README includes a `migration` tool group entry covering all tools.

6. **Given** `frMapping` in tool manifest **When** reviewed **Then** covers FR-55 and FR-56.

## Tasks / Subtasks

- [x] Implement `migration_getBatchSummary` (FR-55) (AC: 1, 2)
  - [x] For each batchId: GET `/engine/{engineName}/batch/statistics?batchId={id}` for job counts
  - [x] GET `/engine/{engineName}/history/batch/{id}` for timing and definition IDs
  - [x] Aggregate: `totalSubmitted = sum(totalJobs)`, `succeeded = sum(completedJobs - failedJobs)`, `failed = sum(failedJobs)`
  - [x] Build `failureBreakdown` from job exception messages (requires querying historic job logs)
  - [x] Return: `{ sourceDefinitionId, targetDefinitionId, totalSubmitted, succeeded, failed, failureBreakdown, duration }`
- [x] Implement `migration_listAuditEntries` (FR-56) (AC: 3, 4)
  - [x] GET `/engine/{engineName}/history/user-operation` with `operationType=Migrate` filter
  - [x] Accept optional `processDefinitionKey`, `startedAfter`, `startedBefore` filters
  - [x] Map response to: `{ operatorId: userId, timestamp: timestamp, operationType, sourceDefinitionId, targetDefinitionId, outcome }`
- [x] Update README.md to add `migration` tool group entry (AC: 5)
- [x] Register tools in `src/tools/index.ts`
- [x] Write unit tests
- [x] Write integration tests

## Dev Notes

### Historic Batch

`GET /history/batch/{id}` returns `BatchDto` with `startTime`, `endTime`, `totalJobs` etc. for completed batches.

### Audit Entries

`GET /history/user-operation?operationType=Migrate` returns user operation log entries. The key fields are `userId` (operator), `timestamp`, `operationType`, and operation-specific properties in the `property` field.

### Key File Locations

- `src/tools/migration.ts`
- `README.md` — add migration tool group
- `test/unit/tools/migration.test.ts`
- `test/integration/migration.test.ts`

## Dev Agent Record

### Implementation Summary

Implemented `migration_getBatchSummary` (FR-55) and `migration_listAuditEntries` (FR-56) in `src/tools/migration.ts`. Added the `migration` tool group section to `README.md` covering all 16 Epic 12 tools with per-tool summaries. Unit and integration tests written and passing.

### Changes Made

- `src/tools/migration.ts` — FR-55 and FR-56 implementations
- `src/tools/index.ts` — registered both tools
- `README.md` — added `### migration` tool group section with per-tool summary
- `test/unit/tools/migration.test.ts` — unit tests
- `test/integration/migration.test.ts` — integration tests for FR-55, FR-56
