# Story 12.4: Batch Monitoring & Recovery

Status: review

## Story

As an operations engineer scripting a migration,
I want to monitor batch progress, retrieve per-instance failure details, and retry failed jobs without resubmitting the full batch,
so that partial failures are recoverable and migration scripts can run to completion reliably.

## Acceptance Criteria

1. **Given** batch IDs supplied to `migration_awaitBatch` with `timeoutSeconds` and `pollIntervalSeconds` **When** all batches complete before timeout **Then** response is `{ status: "COMPLETED", progress: { completed, failed, pending: 0 } }`.

2. **Given** timeout reached before completion **When** `migration_awaitBatch` returns **Then** response is `{ status: "TIMEOUT", progress: { completed, failed, pending } }`.

3. **Given** a batch ID supplied to `migration_getBatchStatus` **When** called **Then** returns `{ totalJobs, jobsCreated, jobsCompleted, jobsFailed, suspended }`.

4. **Given** batch IDs with failed jobs supplied to `migration_getBatchFailures` **When** called **Then** returns flat deduplicated list of `{ processInstanceId, jobId, failureType, errorMessage, stacktrace }`; `failureType` includes `EXHAUSTED_RETRIES`.

5. **Given** batch IDs with failed jobs supplied to `migration_retryFailedJobs` **When** called **Then** retries reset on all failed jobs; per-batch confirmation returned.

6. **Given** `migration_retryFailedJobs` called on batch with no failed jobs **When** called **Then** returns `{ retriedCount: 0 }`.

7. **Given** the `frMapping` field in the tool manifest **When** reviewed **Then** covers FR-49, FR-50, FR-51, FR-52.

## Tasks / Subtasks

- [x] Implement `migration_awaitBatch` (FR-49) (AC: 1, 2)
  - [x] Accept `batchIds: string[]`, `timeoutSeconds: number`, `pollIntervalSeconds: number` (default 5)
  - [x] Poll `GET /engine/{engineName}/batch/statistics?batchId={id}` for each batch
  - [x] Aggregate progress: `completed = sum(completedJobs)`, `failed = sum(failedJobs)`, `pending = sum(remainingJobs - failedJobs)`
  - [x] Return COMPLETED when `pending === 0` for all batches; TIMEOUT if deadline exceeded
- [x] Implement `migration_getBatchStatus` (FR-50) (AC: 3)
  - [x] GET `/engine/{engineName}/batch/statistics?batchId={id}`
  - [x] Return: `{ totalJobs, jobsCreated, jobsCompleted: completedJobs, jobsFailed: failedJobs, suspended }`
- [x] Implement `migration_getBatchFailures` (FR-51) (AC: 4)
  - [x] For each batchId: GET `/engine/{engineName}/batch/{id}` to get `batchJobDefinitionId`
  - [x] GET `/engine/{engineName}/job?jobDefinitionId={batchJobDefinitionId}&noRetriesLeft=true` to get failed job IDs
  - [x] For each failed job: GET `/engine/{engineName}/job/{id}/stacktrace` and GET `/engine/{engineName}/job/{id}`
  - [x] Return deduplicated list with failureType = `EXHAUSTED_RETRIES` for zero-retry jobs
- [x] Implement `migration_retryFailedJobs` (FR-52) (AC: 5, 6)
  - [x] For each batchId: find failed jobs (same as getBatchFailures)
  - [x] POST `/engine/{engineName}/job/retries` with `{ retries: 1, jobQuery: { jobDefinitionId, noRetriesLeft: true } }`
  - [x] Return `{ retriedCount, perBatch: [{ batchId, retriedCount }] }`
- [x] Register all tools in `src/tools/index.ts`
- [x] Write unit tests (mock polling)
- [x] Write integration tests

## Dev Notes

### Polling Loop (awaitBatch)

```typescript
const deadline = Date.now() + timeoutSeconds * 1000;
while (Date.now() < deadline) {
  // check all batches
  if (allComplete) return { status: "COMPLETED", progress };
  await sleep(pollIntervalSeconds * 1000);
}
return { status: "TIMEOUT", progress };
```

Note: `sleep` must be mockable in unit tests. Use a configurable delay function.

### Key File Locations

- `src/tools/migration.ts`
- `test/unit/tools/migration.test.ts`
- `test/integration/migration.test.ts`

## Dev Agent Record

### Implementation Summary

Implemented all four tools in `src/tools/migration.ts`. `migration_awaitBatch` accepts an injectable `sleepFn` parameter for unit test determinism. `migration_getBatchFailures` chains three API calls per batch (batch → batchJobDefinitionId → failed jobs → stacktrace per job). `migration_retryFailedJobs` uses `POST /job/retries` bulk endpoint. Unit and integration tests written and passing.

### Changes Made

- `src/tools/migration.ts` — FR-49, FR-50, FR-51, FR-52 implementations
- `src/tools/index.ts` — registered all four tools
- `test/unit/tools/migration.test.ts` — unit tests including polling mock
- `test/integration/migration.test.ts` — integration tests for FR-49, FR-50
