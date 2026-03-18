# Story 12.3: Async Batch Execution

Status: review

## Story

As an operations engineer scripting a migration,
I want to execute a validated migration plan as an asynchronous batch with auto-chunking, migration instructions, and the ability to suspend, resume, or cancel batches mid-execution,
so that large migrations can be managed safely without overwhelming the engine.

## Acceptance Criteria

1. **Given** a migration plan, instance ID list, and optional `batchSize` are supplied to `migration_executeBatch` **When** the instance count does not exceed `batchSize` (default: 100) **Then** a single Operaton batch is created and the tool returns `{ batches: [{ batchId, instanceCount }], totalInstances, chunked: false }`.

2. **Given** the instance count exceeds `batchSize` **When** `migration_executeBatch` is called **Then** the tool auto-chunks and returns `{ batches: [...], totalInstances, chunked: true }`.

3. **Given** `migration_executeBatch` is called with `instructions` **When** the batch is submitted **Then** cancellations and variable updates are explicit in each Operaton batch payload.

4. **Given** instances already on the target version **When** `migration_executeBatch` is called **Then** those instances are skipped; response includes `skippedCount`.

5. **Given** batch IDs supplied to `migration_suspendBatch` **When** called **Then** each batch is suspended; per-batch confirmation or structured error returned.

6. **Given** suspended batch IDs supplied to `migration_resumeBatch` **When** called **Then** each batch resumes; per-batch confirmation returned.

7. **Given** batch IDs supplied to `migration_deleteBatch` **When** called **Then** each batch cancelled; per-batch confirmation returned.

8. **Given** `migration_listBatches` called with optional state filter **When** called **Then** active migration batches matching filter returned.

9. **Given** `migration_executeBatch` called with `dryRun: true` **When** called **Then** routed to `POST /migration/validate`; response mirrors executeBatch shape with `dryRun: true` flag; no batches created.

10. **Given** chunk submissions fail during auto-chunked execution **When** `migration_executeBatch` returns **Then** response includes `submissionErrors[]` with `{ chunkIndex, error }` for each failed chunk.

## Tasks / Subtasks

- [x] Implement `migration_executeBatch` (FR-47) (AC: 1–4, 9, 10)
  - [x] Accept: `plan`, `instanceIds`, `batchSize?` (default 100), `instructions?`, `dryRun?`
  - [x] If `dryRun`: POST to `/migration/validate` and return validate result with `dryRun: true, batches: [], chunked: false`
  - [x] Filter out instances already on target definition version (call `GET /process-instance?processDefinitionId={targetId}&processInstanceIds={ids}`)
  - [x] Chunk `instanceIds` into groups of `batchSize`
  - [x] For each chunk: POST `/engine/{engineName}/migration/executeAsync` with plan + chunk + optional instructions
  - [x] Collect successful `{ batchId, instanceCount }` and failed `{ chunkIndex, error }` entries
  - [x] Return: `{ batches, totalInstances, chunked, skippedCount, submissionErrors? }`
- [x] Implement `migration_suspendBatch` (FR-48) (AC: 5)
  - [x] Accept `batchIds: string[]`
  - [x] For each: PUT `/engine/{engineName}/batch/{id}/suspended` with `{ suspended: true }`
  - [x] Return per-batch results
- [x] Implement `migration_resumeBatch` (FR-48) (AC: 6)
  - [x] Same as suspend but `{ suspended: false }`
- [x] Implement `migration_deleteBatch` (FR-54) (AC: 7)
  - [x] Accept `batchIds: string[]`
  - [x] For each: DELETE `/engine/{engineName}/batch/{id}`
  - [x] Return per-batch results
- [x] Implement `migration_listBatches` (FR-53) (AC: 8)
  - [x] GET `/engine/{engineName}/batch` with `type=MIGRATE_PROCESS_INSTANCE` always applied
  - [x] Accept optional `suspended` filter
  - [x] Return list with batchId, totalJobs, jobsCreated, suspended, startTime
- [x] Register all tools in `src/tools/index.ts`
- [x] Write unit tests
- [x] Write integration tests

## Dev Notes

### Batch Type

The Operaton batch type for migration is `MIGRATE_PROCESS_INSTANCE`. Always filter `migration_listBatches` to this type.

### Auto-chunking

```typescript
const chunks = [];
for (let i = 0; i < instanceIds.length; i += batchSize) {
  chunks.push(instanceIds.slice(i, i + batchSize));
}
```

### Key File Locations

- `src/tools/migration.ts`
- `test/unit/tools/migration.test.ts`
- `test/integration/migration.test.ts`

## Dev Agent Record

### Implementation Summary

Implemented all five tools in `src/tools/migration.ts`. `migration_executeBatch` auto-chunks, filters already-migrated instances, and supports dry-run mode. Batch lifecycle tools (suspend, resume, delete, list) all hardcode `MIGRATE_PROCESS_INSTANCE` type filter. Unit and integration tests written and passing (128 total tests pass).

### Changes Made

- `src/tools/migration.ts` — FR-47, FR-48, FR-53, FR-54 implementations
- `src/tools/index.ts` — registered all five tools
- `test/unit/tools/migration.test.ts` — unit tests
- `test/integration/migration.test.ts` — integration tests for FR-47, FR-48, FR-53, FR-54
