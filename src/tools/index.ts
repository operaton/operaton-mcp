// Copyright Operaton contributors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Hand-written tool overrides for operations requiring special treatment
// (e.g. multipart uploads, complex request shaping, MCP-side aggregation)
import { z } from "zod";
import type { OperatonClient } from "../http/client.js";
import {
  deploymentCreate,
  deploymentCreateInputSchema,
} from "./deployment.js";
import {
  processInstanceListMigratable,
  processInstanceListMigratableInputSchema,
  processDefinitionGetMigrationCandidates,
  processDefinitionGetMigrationCandidatesInputSchema,
  migrationGeneratePlan,
  migrationGeneratePlanInputSchema,
  migrationValidatePlan,
  migrationValidatePlanInputSchema,
  migrationExecuteBatch,
  migrationExecuteBatchInputSchema,
  migrationSuspendBatch,
  migrationSuspendBatchInputSchema,
  migrationResumeBatch,
  migrationResumeBatchInputSchema,
  migrationDeleteBatch,
  migrationDeleteBatchInputSchema,
  migrationListBatches,
  migrationListBatchesInputSchema,
  migrationAwaitBatch,
  migrationAwaitBatchInputSchema,
  migrationGetBatchStatus,
  migrationGetBatchStatusInputSchema,
  migrationGetBatchFailures,
  migrationGetBatchFailuresInputSchema,
  migrationRetryFailedJobs,
  migrationRetryFailedJobsInputSchema,
  migrationGetBatchSummary,
  migrationGetBatchSummaryInputSchema,
  migrationListAuditEntries,
  migrationListAuditEntriesInputSchema,
  migrationListHistoricBatches,
  migrationListHistoricBatchesInputSchema,
} from "./migration.js";

export interface CustomToolEntry {
  name: string;
  description: string;
  group: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (input: Record<string, unknown>, client: OperatonClient) => Promise<{ isError?: boolean; content: Array<{ type: "text"; text: string }> }>;
  resourceDomain: string;
  operationClass: string;
}

export function getCustomTools(client: OperatonClient): CustomToolEntry[] {
  return [
    {
      name: "deployment_create",
      description:
        "Deploy a BPMN or DMN artifact to Operaton. Provide the XML content, filename (.bpmn or .dmn), and a deployment name. Returns deployment ID and deployed definition keys.",
      group: "deployment",
      schema: deploymentCreateInputSchema,
      handler: (input, _client) =>
        deploymentCreate(input as z.infer<typeof deploymentCreateInputSchema>, _client),
      resourceDomain: "deployments",
      operationClass: "deploy",
    },
    {
      name: "processDefinition_deploy",
      description:
        "Deploy a BPMN process definition to Operaton. Provide BPMN or DMN XML, a filename, and a deployment name. Returns deployment metadata and deployed definition keys.",
      group: "processDefinition",
      schema: deploymentCreateInputSchema,
      handler: (input, _client) =>
        deploymentCreate(input as z.infer<typeof deploymentCreateInputSchema>, _client),
      resourceDomain: "process-definitions",
      operationClass: "deploy",
    },
    {
      name: "decision_deploy",
      description:
        "Deploy a DMN decision artifact to Operaton. Provide DMN XML, a .dmn filename, and a deployment name. Returns deployment metadata and deployed decision definition keys.",
      group: "decision",
      schema: deploymentCreateInputSchema,
      handler: (input, _client) =>
        deploymentCreate(input as z.infer<typeof deploymentCreateInputSchema>, _client),
      resourceDomain: "decisions",
      operationClass: "deploy",
    },
    // ── Epic 12: Process Instance Migration ────────────────────────────────────
    {
      name: "processInstance_listMigratable",
      description:
        "List active process instances eligible for migration. Returns per-instance eligibility with call-activity blocking conditions. Filters: definition key, source version, business key pattern.",
      group: "migration",
      schema: processInstanceListMigratableInputSchema,
      handler: (input, c) =>
        processInstanceListMigratable(input as z.infer<typeof processInstanceListMigratableInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "migrate-control",
    },
    {
      name: "processDefinition_getMigrationCandidates",
      description:
        "Compare source and target process definition activities. Returns auto-mappable pairs, unmapped source activities, new target activities. Optionally checks required variable presence on supplied instance IDs.",
      group: "migration",
      schema: processDefinitionGetMigrationCandidatesInputSchema,
      handler: (input, c) =>
        processDefinitionGetMigrationCandidates(input as z.infer<typeof processDefinitionGetMigrationCandidatesInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "migrate-control",
    },
    {
      name: "migration_generatePlan",
      description:
        "Generate a migration plan from a source to target process definition. Returns auto-mapped activity instructions and a list of unmapped source activities requiring explicit mapping.",
      group: "migration",
      schema: migrationGeneratePlanInputSchema,
      handler: (input, c) =>
        migrationGeneratePlan(input as z.infer<typeof migrationGeneratePlanInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "migrate-control",
    },
    {
      name: "migration_validatePlan",
      description:
        "Validate a migration plan against a set of process instances. Returns typed errors, sampled-validation flag, and consequence disclosure (timers, external tasks, cancellations).",
      group: "migration",
      schema: migrationValidatePlanInputSchema,
      handler: (input, c) =>
        migrationValidatePlan(input as z.infer<typeof migrationValidatePlanInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "migrate-control",
    },
    {
      name: "migration_executeBatch",
      description:
        "Execute a migration plan asynchronously. Auto-chunks large instance lists. Returns batch IDs and chunk submission errors. Supports dryRun mode (validates without creating batches).",
      group: "migration",
      schema: migrationExecuteBatchInputSchema,
      handler: (input, c) =>
        migrationExecuteBatch(input as z.infer<typeof migrationExecuteBatchInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "migrate-execute",
    },
    {
      name: "migration_suspendBatch",
      description: "Suspend one or more migration batches by ID. Returns per-batch success or error.",
      group: "migration",
      schema: migrationSuspendBatchInputSchema,
      handler: (input, c) =>
        migrationSuspendBatch(input as z.infer<typeof migrationSuspendBatchInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "suspend-resume",
    },
    {
      name: "migration_resumeBatch",
      description: "Resume one or more suspended migration batches by ID. Returns per-batch success or error.",
      group: "migration",
      schema: migrationResumeBatchInputSchema,
      handler: (input, c) =>
        migrationResumeBatch(input as z.infer<typeof migrationResumeBatchInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "suspend-resume",
    },
    {
      name: "migration_deleteBatch",
      description: "Cancel (delete) one or more migration batches by ID. Returns per-batch success or error.",
      group: "migration",
      schema: migrationDeleteBatchInputSchema,
      handler: (input, c) =>
        migrationDeleteBatch(input as z.infer<typeof migrationDeleteBatchInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "delete",
    },
    {
      name: "migration_listBatches",
      description:
        "List active migration batches (type MIGRATE_PROCESS_INSTANCE). Optionally filter by suspended state.",
      group: "migration",
      schema: migrationListBatchesInputSchema,
      handler: (input, c) =>
        migrationListBatches(input as z.infer<typeof migrationListBatchesInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "migrate-control",
    },
    {
      name: "migration_awaitBatch",
      description:
        "Poll migration batch(es) until all complete or timeout is reached. Returns COMPLETED or TIMEOUT with aggregated progress (completed, failed, pending job counts).",
      group: "migration",
      schema: migrationAwaitBatchInputSchema,
      handler: (input, c) =>
        migrationAwaitBatch(input as z.infer<typeof migrationAwaitBatchInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "migrate-control",
    },
    {
      name: "migration_getBatchStatus",
      description:
        "Get current status of a single migration batch: totalJobs, jobsCreated, jobsCompleted, jobsFailed, suspended.",
      group: "migration",
      schema: migrationGetBatchStatusInputSchema,
      handler: (input, c) =>
        migrationGetBatchStatus(input as z.infer<typeof migrationGetBatchStatusInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "migrate-control",
    },
    {
      name: "migration_getBatchFailures",
      description:
        "Retrieve per-instance failure details for one or more migration batches. Returns processInstanceId, jobId, failureType (EXHAUSTED_RETRIES), errorMessage, and stacktrace.",
      group: "migration",
      schema: migrationGetBatchFailuresInputSchema,
      handler: (input, c) =>
        migrationGetBatchFailures(input as z.infer<typeof migrationGetBatchFailuresInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "migrate-control",
    },
    {
      name: "migration_retryFailedJobs",
      description:
        "Reset retries on all failed migration jobs in one or more batches. Returns total retried count and per-batch breakdown.",
      group: "migration",
      schema: migrationRetryFailedJobsInputSchema,
      handler: (input, c) =>
        migrationRetryFailedJobs(input as z.infer<typeof migrationRetryFailedJobsInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "migrate-execute",
    },
    {
      name: "migration_getBatchSummary",
      description:
        "Aggregate post-migration summary across one or more batch IDs: totalSubmitted, succeeded, failed, duration. Suitable for deployment sign-off records.",
      group: "migration",
      schema: migrationGetBatchSummaryInputSchema,
      handler: (input, c) =>
        migrationGetBatchSummary(input as z.infer<typeof migrationGetBatchSummaryInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "migrate-control",
    },
    {
      name: "migration_listAuditEntries",
      description:
        "Query the Operaton user operation log for migration audit entries. Returns operatorId, timestamp, operationType. Filters: processDefinitionKey, date range.",
      group: "migration",
      schema: migrationListAuditEntriesInputSchema,
      handler: (input, c) =>
        migrationListAuditEntries(input as z.infer<typeof migrationListAuditEntriesInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "migrate-control",
    },
    {
      name: "migration_listHistoricBatches",
      description:
        "Query historic migration batches from the Operaton history log. Filters: completion status, date range. Always scoped to MIGRATE_PROCESS_INSTANCE batch type.",
      group: "migration",
      schema: migrationListHistoricBatchesInputSchema,
      handler: (input, c) =>
        migrationListHistoricBatches(input as z.infer<typeof migrationListHistoricBatchesInputSchema>, c),
      resourceDomain: "migrations",
      operationClass: "migrate-control",
    },
  ];
  void client;
}
