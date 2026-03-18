# Story 12.6: Historic Batch Access

Status: review

## Story

As an operations engineer reviewing past migrations,
I want to query the Operaton historic batch log for completed migration batches,
so that I can verify migration history after batches are no longer visible in the active batch list.

## Acceptance Criteria

1. **Given** `migration_listHistoricBatches` called without filters **When** called **Then** returns historic migration batch records from `GET /history/batch` including batch ID, total jobs, completion status, start time, and end time.

2. **Given** `migration_listHistoricBatches` called with a state filter **When** called **Then** only batches matching the supplied state are returned.

3. **Given** `migration_listHistoricBatches` called with a date range filter **When** called **Then** only batches whose start time falls within the supplied range are returned.

4. **Given** a batch ID from `migration_executeBatch` looked up in historic batches after completion **When** `migration_listHistoricBatches` called **Then** batch record present with accurate completion status.

5. **Given** `frMapping` reviewed **When** checked **Then** covers FR-57.

## Tasks / Subtasks

- [x] Implement `migration_listHistoricBatches` (FR-57) (AC: 1–4)
  - [x] GET `/engine/{engineName}/history/batch` with `type=MIGRATE_PROCESS_INSTANCE` always applied
  - [x] Accept optional `completed` (boolean), `startedAfter` (date-time string), `startedBefore` (date-time string) filters
  - [x] Return list: `{ batches: [{ id, totalJobs, completedJobs, failedJobs, completed, startTime, endTime }] }`
- [x] Register tool in `src/tools/index.ts`
- [x] Write unit tests
- [x] Write integration tests

## Dev Notes

### Historic Batch Fields

`GET /history/batch` returns `HistoricBatchDto` which includes:
- `id`, `type`, `totalJobs`, `jobsCreated`, `batchJobsPerSeed`, `invocationsPerBatchJob`
- `seedJobDefinitionId`, `monitorJobDefinitionId`, `batchJobDefinitionId`
- `tenantId`, `createUserId`, `startTime`, `endTime`, `removalTime`
- `completed` (boolean)

Always filter by `type=MIGRATE_PROCESS_INSTANCE` to avoid returning non-migration batches.

### Key File Locations

- `src/tools/migration.ts`
- `test/unit/tools/migration.test.ts`
- `test/integration/migration.test.ts`

## Dev Agent Record

### Implementation Summary

Implemented `migration_listHistoricBatches` (FR-57) in `src/tools/migration.ts`. Tool hardcodes `type=MIGRATE_PROCESS_INSTANCE` filter and accepts optional `completed`, `startedAfter`, `startedBefore` filters. Registered in `src/tools/index.ts`. Unit and integration tests written and passing.

### Changes Made

- `src/tools/migration.ts` — FR-57 implementation
- `src/tools/index.ts` — registered tool
- `test/unit/tools/migration.test.ts` — unit tests
- `test/integration/migration.test.ts` — integration test for FR-57
