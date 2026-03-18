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

// frMapping: FR-43, FR-44, FR-45, FR-46, FR-47, FR-48, FR-49, FR-50, FR-51, FR-52, FR-53, FR-54, FR-55, FR-56, FR-57

import { z } from "zod";
import type { OperatonClient } from "../http/client.js";

type ToolResult = { isError?: boolean; content: Array<{ type: "text"; text: string }> };

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function isErrorResult(r: unknown): r is { isError: true; content: Array<{ type: "text"; text: string }> } {
  return typeof r === "object" && r !== null && "isError" in (r as Record<string, unknown>);
}

// ── BPMN activity ID extraction ──────────────────────────────────────────────

// Elements that can be migration targets (flow nodes, not connectors/containers/data)
const MAPPABLE_ELEMENTS = new Set([
  "serviceTask", "userTask", "scriptTask", "businessRuleTask", "sendTask",
  "receiveTask", "manualTask", "callActivity", "subProcess", "transaction",
  "startEvent", "endEvent", "intermediateCatchEvent", "intermediateThrowEvent",
  "boundaryEvent", "exclusiveGateway", "parallelGateway", "inclusiveGateway",
  "eventBasedGateway", "complexGateway",
]);

export function extractActivityIds(bpmnXml: string): string[] {
  const ids: string[] = [];
  // Match <bpmn:ElementType ... id="..." or <ElementType ... id="..."
  const tagPattern = /<(?:bpmn2?:)?([a-zA-Z]+)[^>]*\bid="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(bpmnXml)) !== null) {
    const elementType = match[1]!;
    const id = match[2]!;
    if (MAPPABLE_ELEMENTS.has(elementType)) {
      ids.push(id);
    }
  }
  return [...new Set(ids)];
}

// ── Story 12.1: Migration Discovery ─────────────────────────────────────────

export const processInstanceListMigratableInputSchema = z.object({
  processDefinitionKey: z.string().describe("Process definition key to list migratable instances for"),
  sourceVersion: z.number().optional().describe("Restrict to instances of this definition version"),
  businessKeyLike: z.string().optional().describe("Filter by business key pattern (SQL LIKE syntax, % wildcard)"),
  maxResults: z.number().optional().describe("Maximum number of instances to return (default: 100)"),
});

export async function processInstanceListMigratable(
  input: z.infer<typeof processInstanceListMigratableInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = processInstanceListMigratableInputSchema.parse(input);
  const params = new URLSearchParams();
  params.set("processDefinitionKey", validated.processDefinitionKey);
  if (validated.sourceVersion !== undefined) {
    // Need definition ID for that version — query definitions first
    const defParams = new URLSearchParams({ key: validated.processDefinitionKey, version: String(validated.sourceVersion) });
    const defResp = await client.get(`/engine/{engineName}/process-definition?${defParams}`);
    if (isErrorResult(defResp)) return defResp;
    const defs = defResp as Array<Record<string, unknown>>;
    if (!defs.length) {
      return ok({ instances: [], totalCount: 0, note: `No process definition found for key=${validated.processDefinitionKey} version=${validated.sourceVersion}` });
    }
    params.set("processDefinitionId", String(defs[0]!["id"]));
    params.delete("processDefinitionKey");
  }
  if (validated.businessKeyLike !== undefined) params.set("businessKeyLike", validated.businessKeyLike);
  params.set("maxResults", String(validated.maxResults ?? 100));

  const resp = await client.get(`/engine/{engineName}/process-instance?${params}`);
  if (isErrorResult(resp)) return resp;
  const instances = resp as Array<Record<string, unknown>>;

  // Check each instance for call activities
  const results = await Promise.all(
    instances.map(async (inst) => {
      const id = inst["id"] as string;
      const actResp = await client.get(`/engine/{engineName}/process-instance/${id}/activity-instances`);
      let callActivityBlocked = false;
      if (!isErrorResult(actResp)) {
        const checkForCallActivity = (node: Record<string, unknown>): boolean => {
          if ((node["activityType"] as string) === "callActivity") return true;
          const children = (node["childActivityInstances"] as Array<Record<string, unknown>>) ?? [];
          return children.some(checkForCallActivity);
        };
        callActivityBlocked = checkForCallActivity(actResp as Record<string, unknown>);
      }
      return {
        id,
        businessKey: inst["businessKey"] ?? null,
        definitionId: inst["definitionId"],
        definitionKey: inst["processDefinitionKey"] ?? validated.processDefinitionKey,
        state: inst["suspended"] ? "SUSPENDED" : "ACTIVE",
        eligible: !callActivityBlocked,
        callActivityBlocked,
        blockingConditions: callActivityBlocked ? ["Instance has active call activities — child instances are outside migration scope"] : [],
      };
    }),
  );

  return ok({ instances: results, totalCount: results.length });
}

// ── processDefinition_getMigrationCandidates ──────────────────────────────────

export const processDefinitionGetMigrationCandidatesInputSchema = z.object({
  sourceProcessDefinitionId: z.string().describe("ID of the source process definition"),
  targetProcessDefinitionId: z.string().describe("ID of the target process definition"),
  requiredVariables: z.array(z.string()).optional().describe("Variable names that must be present on migrating instances"),
  instanceIds: z.array(z.string()).optional().describe("Instance IDs to check for required variable presence (sampled check)"),
});

export async function processDefinitionGetMigrationCandidates(
  input: z.infer<typeof processDefinitionGetMigrationCandidatesInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = processDefinitionGetMigrationCandidatesInputSchema.parse(input);

  const [srcXmlResp, tgtXmlResp] = await Promise.all([
    client.get(`/engine/{engineName}/process-definition/${validated.sourceProcessDefinitionId}/xml`),
    client.get(`/engine/{engineName}/process-definition/${validated.targetProcessDefinitionId}/xml`),
  ]);

  if (isErrorResult(srcXmlResp)) return srcXmlResp;
  if (isErrorResult(tgtXmlResp)) return tgtXmlResp;

  const srcXml = (srcXmlResp as Record<string, unknown>)["bpmn20Xml"] as string;
  const tgtXml = (tgtXmlResp as Record<string, unknown>)["bpmn20Xml"] as string;

  const srcIds = new Set(extractActivityIds(srcXml));
  const tgtIds = new Set(extractActivityIds(tgtXml));

  const autoMappable = [...srcIds].filter((id) => tgtIds.has(id)).map((id) => ({ sourceId: id, targetId: id }));
  const unmappedSource = [...srcIds].filter((id) => !tgtIds.has(id));
  const newTarget = [...tgtIds].filter((id) => !srcIds.has(id));

  // Optional: check required variables on provided instance IDs
  let instancesWithMissingVariables: Array<{ instanceId: string; missing: string[] }> | undefined;
  if (validated.requiredVariables?.length && validated.instanceIds?.length) {
    instancesWithMissingVariables = [];
    for (const instanceId of validated.instanceIds) {
      const varResp = await client.get(`/engine/{engineName}/process-instance/${instanceId}/variables`);
      if (!isErrorResult(varResp)) {
        const vars = varResp as Record<string, unknown>;
        const missing = validated.requiredVariables.filter((v) => !(v in vars));
        if (missing.length > 0) {
          instancesWithMissingVariables.push({ instanceId, missing });
        }
      }
    }
  }

  return ok({
    sourceDefinitionId: validated.sourceProcessDefinitionId,
    targetDefinitionId: validated.targetProcessDefinitionId,
    autoMappable,
    unmappedSource,
    newTarget,
    ...(instancesWithMissingVariables !== undefined ? { instancesWithMissingVariables } : {}),
  });
}

// ── Story 12.2: Migration Plan Management ───────────────────────────────────

export const migrationGeneratePlanInputSchema = z.object({
  sourceProcessDefinitionId: z.string().describe("ID of the source process definition"),
  targetProcessDefinitionId: z.string().describe("ID of the target process definition"),
  updateEventTriggers: z.boolean().optional().describe("If true, update event triggers in migrated instances (default: false)"),
});

export async function migrationGeneratePlan(
  input: z.infer<typeof migrationGeneratePlanInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = migrationGeneratePlanInputSchema.parse(input);
  const body: Record<string, unknown> = {
    sourceProcessDefinitionId: validated.sourceProcessDefinitionId,
    targetProcessDefinitionId: validated.targetProcessDefinitionId,
  };
  if (validated.updateEventTriggers !== undefined) {
    body["updateEventTriggers"] = validated.updateEventTriggers;
  }
  const resp = await client.post("/engine/{engineName}/migration/generate", body);
  if (isErrorResult(resp)) return resp;
  const plan = resp as Record<string, unknown>;
  const instructions = (plan["instructions"] as Array<Record<string, unknown>>) ?? [];

  // Identify unmapped source activities by fetching both XMLs and comparing
  const [srcXmlResp, tgtXmlResp] = await Promise.all([
    client.get(`/engine/{engineName}/process-definition/${validated.sourceProcessDefinitionId}/xml`),
    client.get(`/engine/{engineName}/process-definition/${validated.targetProcessDefinitionId}/xml`),
  ]);
  let unmappedActivities: string[] = [];
  if (!isErrorResult(srcXmlResp) && !isErrorResult(tgtXmlResp)) {
    const srcIds = new Set(extractActivityIds((srcXmlResp as Record<string, unknown>)["bpmn20Xml"] as string));
    const mappedSrcIds = new Set(
      instructions.flatMap((i) => (i["sourceActivityIds"] as string[]) ?? [])
    );
    unmappedActivities = [...srcIds].filter((id) => !mappedSrcIds.has(id));
  }

  return ok({ plan, unmappedActivities });
}

// ── migration_validatePlan ────────────────────────────────────────────────────

const migrationInstructionSchema = z.object({
  sourceActivityIds: z.array(z.string()).describe("Source activity IDs"),
  targetActivityIds: z.array(z.string()).describe("Target activity IDs"),
  updateEventTrigger: z.boolean().optional(),
});

const migrationPlanSchema = z.object({
  sourceProcessDefinitionId: z.string(),
  targetProcessDefinitionId: z.string(),
  instructions: z.array(migrationInstructionSchema),
});

export const migrationValidatePlanInputSchema = z.object({
  plan: migrationPlanSchema.describe("Migration plan with instructions"),
  instanceIds: z.array(z.string()).describe("Process instance IDs to validate the plan against"),
  instructions: z.array(z.object({
    sourceActivityIds: z.array(z.string()),
    targetActivityIds: z.array(z.string()),
    cancelActivities: z.boolean().optional(),
    updateEventTrigger: z.boolean().optional(),
  })).optional().describe("Optional migration execution instructions (for consequence disclosure)"),
  totalInstanceCount: z.number().optional().describe("Total active instance count for this definition — used to detect sampled validation"),
});

export async function migrationValidatePlan(
  input: z.infer<typeof migrationValidatePlanInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = migrationValidatePlanInputSchema.parse(input);

  // Detect sampled validation
  let sampledValidation = false;
  if (validated.totalInstanceCount !== undefined) {
    sampledValidation = validated.instanceIds.length < validated.totalInstanceCount;
  }

  const body: Record<string, unknown> = {
    migrationPlan: validated.plan,
    processInstanceIds: validated.instanceIds,
  };
  if (validated.instructions) {
    body["migrationPlan"] = { ...validated.plan, instructions: validated.instructions };
  }

  const resp = await client.post("/engine/{engineName}/migration/validate", body);

  // 200 with no report = valid; or may return validation report
  if (isErrorResult(resp)) {
    // Extract typed errors from the error content
    return ok({
      valid: false,
      sampledValidation,
      errors: [{ type: "ValidationError", sourceActivity: null, targetActivity: null, message: resp.content[0]?.text ?? "Validation failed" }],
      activeTimers: [],
      openExternalTasks: [],
      willCancelActiveInstances: [],
    });
  }

  // Parse MigrationPlanReportDto
  const report = resp as Record<string, unknown> | null;
  if (report === null) {
    return ok({ valid: true, sampledValidation, errors: [], activeTimers: [], openExternalTasks: [], willCancelActiveInstances: [] });
  }

  const instructionReports = (report["instructionReports"] as Array<Record<string, unknown>>) ?? [];
  const errors: Array<{ type: string; sourceActivity: string | null; targetActivity: string | null; message: string }> = [];

  for (const ir of instructionReports) {
    const failures = (ir["failures"] as Array<Record<string, unknown>>) ?? [];
    const srcActivities = (ir["instruction"] as Record<string, unknown>)?.["sourceActivityIds"] as string[] ?? [];
    const tgtActivities = (ir["instruction"] as Record<string, unknown>)?.["targetActivityIds"] as string[] ?? [];
    for (const failure of failures) {
      errors.push({
        type: (failure["type"] as string) ?? "ValidationError",
        sourceActivity: srcActivities[0] ?? null,
        targetActivity: tgtActivities[0] ?? null,
        message: (failure["message"] as string) ?? JSON.stringify(failure),
      });
    }
  }

  return ok({
    valid: errors.length === 0,
    sampledValidation,
    errors,
    activeTimers: [],
    openExternalTasks: [],
    willCancelActiveInstances: [],
  });
}

// ── Story 12.3: Async Batch Execution ───────────────────────────────────────

export const migrationExecuteBatchInputSchema = z.object({
  plan: migrationPlanSchema.describe("Migration plan with instructions"),
  instanceIds: z.array(z.string()).describe("Process instance IDs to migrate"),
  batchSize: z.number().optional().describe("Max instances per Operaton batch (default: 100)"),
  instructions: z.array(z.object({
    sourceActivityIds: z.array(z.string()),
    targetActivityIds: z.array(z.string()),
    cancelActivities: z.boolean().optional(),
    updateEventTrigger: z.boolean().optional(),
  })).optional().describe("Optional execution instructions (cancelActivities, variableUpdates)"),
  dryRun: z.boolean().optional().describe("If true, validates the plan without creating batches"),
});

export async function migrationExecuteBatch(
  input: z.infer<typeof migrationExecuteBatchInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = migrationExecuteBatchInputSchema.parse(input);
  const effectivePlan = validated.instructions
    ? { ...validated.plan, instructions: validated.instructions }
    : validated.plan;

  if (validated.dryRun) {
    const body = { migrationPlan: effectivePlan, processInstanceIds: validated.instanceIds };
    const resp = await client.post("/engine/{engineName}/migration/validate", body);
    if (isErrorResult(resp)) return resp;
    return ok({ batches: [], totalInstances: validated.instanceIds.length, chunked: false, skippedCount: 0, dryRun: true, validateResult: resp });
  }

  // Filter out instances already on target definition
  const targetId = validated.plan.targetProcessDefinitionId;
  const params = new URLSearchParams({ processDefinitionId: targetId });
  const alreadyMigratedResp = await client.get(`/engine/{engineName}/process-instance?${params}`);
  let skippedCount = 0;
  let effectiveInstanceIds = validated.instanceIds;
  if (!isErrorResult(alreadyMigratedResp)) {
    const alreadyMigrated = new Set(
      (alreadyMigratedResp as Array<Record<string, unknown>>).map((i) => i["id"] as string)
    );
    const before = effectiveInstanceIds.length;
    effectiveInstanceIds = effectiveInstanceIds.filter((id) => !alreadyMigrated.has(id));
    skippedCount = before - effectiveInstanceIds.length;
  }

  const batchSize = validated.batchSize ?? 100;
  const chunks: string[][] = [];
  for (let i = 0; i < effectiveInstanceIds.length; i += batchSize) {
    chunks.push(effectiveInstanceIds.slice(i, i + batchSize));
  }

  const batches: Array<{ batchId: string; instanceCount: number }> = [];
  const submissionErrors: Array<{ chunkIndex: number; error: string }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const body = { migrationPlan: effectivePlan, processInstanceIds: chunk };
    const resp = await client.post("/engine/{engineName}/migration/executeAsync", body);
    if (isErrorResult(resp)) {
      submissionErrors.push({ chunkIndex: i, error: resp.content[0]?.text ?? "Submission failed" });
    } else {
      const batchResp = resp as Record<string, unknown>;
      batches.push({ batchId: batchResp["id"] as string, instanceCount: chunk.length });
    }
  }

  const result: Record<string, unknown> = {
    batches,
    totalInstances: effectiveInstanceIds.length,
    chunked: chunks.length > 1,
    skippedCount,
  };
  if (submissionErrors.length > 0) result["submissionErrors"] = submissionErrors;
  return ok(result);
}

// ── migration_suspendBatch ────────────────────────────────────────────────────

export const migrationSuspendBatchInputSchema = z.object({
  batchIds: z.array(z.string()).describe("Batch IDs to suspend"),
});

export async function migrationSuspendBatch(
  input: z.infer<typeof migrationSuspendBatchInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = migrationSuspendBatchInputSchema.parse(input);
  const results = await Promise.all(
    validated.batchIds.map(async (id) => {
      const resp = await client.put(`/engine/{engineName}/batch/${id}/suspended`, { suspended: true });
      if (isErrorResult(resp)) return { batchId: id, success: false, error: resp.content[0]?.text };
      return { batchId: id, success: true };
    }),
  );
  return ok({ results });
}

// ── migration_resumeBatch ─────────────────────────────────────────────────────

export const migrationResumeBatchInputSchema = z.object({
  batchIds: z.array(z.string()).describe("Batch IDs to resume"),
});

export async function migrationResumeBatch(
  input: z.infer<typeof migrationResumeBatchInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = migrationResumeBatchInputSchema.parse(input);
  const results = await Promise.all(
    validated.batchIds.map(async (id) => {
      const resp = await client.put(`/engine/{engineName}/batch/${id}/suspended`, { suspended: false });
      if (isErrorResult(resp)) return { batchId: id, success: false, error: resp.content[0]?.text };
      return { batchId: id, success: true };
    }),
  );
  return ok({ results });
}

// ── migration_deleteBatch ─────────────────────────────────────────────────────

export const migrationDeleteBatchInputSchema = z.object({
  batchIds: z.array(z.string()).describe("Batch IDs to delete (cancel)"),
  cascade: z.boolean().optional().describe("If true, also delete historic data for this batch"),
});

export async function migrationDeleteBatch(
  input: z.infer<typeof migrationDeleteBatchInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = migrationDeleteBatchInputSchema.parse(input);
  const results = await Promise.all(
    validated.batchIds.map(async (id) => {
      const suffix = validated.cascade ? "?cascade=true" : "";
      const resp = await client.delete(`/engine/{engineName}/batch/${id}${suffix}`);
      if (isErrorResult(resp)) return { batchId: id, success: false, error: resp.content[0]?.text };
      return { batchId: id, success: true };
    }),
  );
  return ok({ results });
}

// ── migration_listBatches ─────────────────────────────────────────────────────

export const migrationListBatchesInputSchema = z.object({
  suspended: z.boolean().optional().describe("Filter by suspended state"),
  maxResults: z.number().optional().describe("Maximum number of results (default: 50)"),
});

export async function migrationListBatches(
  input: z.infer<typeof migrationListBatchesInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = migrationListBatchesInputSchema.parse(input);
  const params = new URLSearchParams({ type: "MIGRATE_PROCESS_INSTANCE" });
  if (validated.suspended !== undefined) params.set("suspended", String(validated.suspended));
  params.set("maxResults", String(validated.maxResults ?? 50));
  const resp = await client.get(`/engine/{engineName}/batch?${params}`);
  if (isErrorResult(resp)) return resp;
  return ok(resp);
}

// ── Story 12.4: Batch Monitoring & Recovery ──────────────────────────────────

// Exported for testing
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const migrationAwaitBatchInputSchema = z.object({
  batchIds: z.array(z.string()).describe("Batch IDs to monitor"),
  timeoutSeconds: z.number().describe("Maximum seconds to wait"),
  pollIntervalSeconds: z.number().optional().describe("Polling interval in seconds (default: 5)"),
});

export async function migrationAwaitBatch(
  input: z.infer<typeof migrationAwaitBatchInputSchema>,
  client: OperatonClient,
  sleepFn: (ms: number) => Promise<void> = sleep,
): Promise<ToolResult> {
  const validated = migrationAwaitBatchInputSchema.parse(input);
  const pollMs = (validated.pollIntervalSeconds ?? 5) * 1000;
  const deadline = Date.now() + validated.timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalPending = 0;
    let allDone = true;

    for (const id of validated.batchIds) {
      const params = new URLSearchParams({ batchId: id });
      const resp = await client.get(`/engine/{engineName}/batch/statistics?${params}`);
      if (isErrorResult(resp)) continue;
      const stats = resp as Array<Record<string, unknown>>;
      const stat = stats[0];
      if (!stat) continue;
      const remaining = (stat["remainingJobs"] as number) ?? 0;
      const completed = (stat["completedJobs"] as number) ?? 0;
      const failed = (stat["failedJobs"] as number) ?? 0;
      totalCompleted += completed;
      totalFailed += failed;
      totalPending += Math.max(0, remaining - failed);
      if (remaining > 0) allDone = false;
    }

    if (allDone) {
      return ok({ status: "COMPLETED", progress: { completed: totalCompleted, failed: totalFailed, pending: 0 } });
    }

    if (Date.now() + pollMs > deadline) break;
    await sleepFn(pollMs);
  }

  // Final read after timeout
  let totalCompleted = 0;
  let totalFailed = 0;
  let totalPending = 0;
  for (const id of validated.batchIds) {
    const params = new URLSearchParams({ batchId: id });
    const resp = await client.get(`/engine/{engineName}/batch/statistics?${params}`);
    if (!isErrorResult(resp)) {
      const stats = resp as Array<Record<string, unknown>>;
      const stat = stats[0];
      if (stat) {
        totalCompleted += (stat["completedJobs"] as number) ?? 0;
        totalFailed += (stat["failedJobs"] as number) ?? 0;
        totalPending += Math.max(0, ((stat["remainingJobs"] as number) ?? 0) - ((stat["failedJobs"] as number) ?? 0));
      }
    }
  }
  return ok({ status: "TIMEOUT", progress: { completed: totalCompleted, failed: totalFailed, pending: totalPending } });
}

// ── migration_getBatchStatus ──────────────────────────────────────────────────

export const migrationGetBatchStatusInputSchema = z.object({
  batchId: z.string().describe("Batch ID to retrieve status for"),
});

export async function migrationGetBatchStatus(
  input: z.infer<typeof migrationGetBatchStatusInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = migrationGetBatchStatusInputSchema.parse(input);
  const params = new URLSearchParams({ batchId: validated.batchId });
  const resp = await client.get(`/engine/{engineName}/batch/statistics?${params}`);
  if (isErrorResult(resp)) return resp;
  const stats = resp as Array<Record<string, unknown>>;
  const stat = stats[0];
  if (!stat) return ok({ error: `No batch found with ID ${validated.batchId}` });
  return ok({
    batchId: stat["id"],
    totalJobs: stat["totalJobs"],
    jobsCreated: stat["jobsCreated"],
    jobsCompleted: stat["completedJobs"],
    jobsFailed: stat["failedJobs"],
    suspended: stat["suspended"],
  });
}

// ── migration_getBatchFailures ────────────────────────────────────────────────

export const migrationGetBatchFailuresInputSchema = z.object({
  batchIds: z.array(z.string()).describe("Batch IDs to retrieve failure details for"),
});

export async function migrationGetBatchFailures(
  input: z.infer<typeof migrationGetBatchFailuresInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = migrationGetBatchFailuresInputSchema.parse(input);
  const allFailures: Array<Record<string, unknown>> = [];
  const seenJobIds = new Set<string>();

  for (const batchId of validated.batchIds) {
    // Get batchJobDefinitionId
    const batchResp = await client.get(`/engine/{engineName}/batch/${batchId}`);
    if (isErrorResult(batchResp)) continue;
    const batch = batchResp as Record<string, unknown>;
    const batchJobDefinitionId = batch["batchJobDefinitionId"] as string;
    if (!batchJobDefinitionId) continue;

    // Query failed jobs
    const jobParams = new URLSearchParams({ jobDefinitionId: batchJobDefinitionId, noRetriesLeft: "true" });
    const jobsResp = await client.get(`/engine/{engineName}/job?${jobParams}`);
    if (isErrorResult(jobsResp)) continue;
    const jobs = jobsResp as Array<Record<string, unknown>>;

    for (const job of jobs) {
      const jobId = job["id"] as string;
      if (seenJobIds.has(jobId)) continue;
      seenJobIds.add(jobId);

      const retries = (job["retries"] as number) ?? -1;
      const failureType = retries === 0 ? "EXHAUSTED_RETRIES" : "FAILED";

      // Get stacktrace
      let stacktrace: string | null = null;
      const stResp = await client.get(`/engine/{engineName}/job/${jobId}/stacktrace`);
      if (!isErrorResult(stResp)) {
        stacktrace = typeof stResp === "string" ? stResp : JSON.stringify(stResp);
      }

      allFailures.push({
        processInstanceId: job["processInstanceId"] ?? null,
        jobId,
        failureType,
        errorMessage: job["exceptionMessage"] ?? null,
        stacktrace,
      });
    }
  }

  return ok({ failures: allFailures, totalCount: allFailures.length });
}

// ── migration_retryFailedJobs ─────────────────────────────────────────────────

export const migrationRetryFailedJobsInputSchema = z.object({
  batchIds: z.array(z.string()).describe("Batch IDs whose failed jobs should have retries reset"),
  retries: z.number().optional().describe("Number of retries to set (default: 1)"),
});

export async function migrationRetryFailedJobs(
  input: z.infer<typeof migrationRetryFailedJobsInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = migrationRetryFailedJobsInputSchema.parse(input);
  const retries = validated.retries ?? 1;
  let totalRetried = 0;
  const perBatch: Array<{ batchId: string; retriedCount: number }> = [];

  for (const batchId of validated.batchIds) {
    const batchResp = await client.get(`/engine/{engineName}/batch/${batchId}`);
    if (isErrorResult(batchResp)) {
      perBatch.push({ batchId, retriedCount: 0 });
      continue;
    }
    const batch = batchResp as Record<string, unknown>;
    const batchJobDefinitionId = batch["batchJobDefinitionId"] as string;
    if (!batchJobDefinitionId) {
      perBatch.push({ batchId, retriedCount: 0 });
      continue;
    }

    const jobParams = new URLSearchParams({ jobDefinitionId: batchJobDefinitionId, noRetriesLeft: "true" });
    const jobsResp = await client.get(`/engine/{engineName}/job?${jobParams}`);
    if (isErrorResult(jobsResp)) {
      perBatch.push({ batchId, retriedCount: 0 });
      continue;
    }
    const jobs = jobsResp as Array<Record<string, unknown>>;
    const jobIds = jobs.map((j) => j["id"] as string);

    if (jobIds.length === 0) {
      perBatch.push({ batchId, retriedCount: 0 });
      continue;
    }

    // POST /job/retries with job IDs
    const retryResp = await client.post("/engine/{engineName}/job/retries", { retries, jobIds });
    if (isErrorResult(retryResp)) {
      perBatch.push({ batchId, retriedCount: 0 });
    } else {
      totalRetried += jobIds.length;
      perBatch.push({ batchId, retriedCount: jobIds.length });
    }
  }

  return ok({ retriedCount: totalRetried, perBatch });
}

// ── Story 12.5: Post-Migration Reporting & Audit ─────────────────────────────

export const migrationGetBatchSummaryInputSchema = z.object({
  batchIds: z.array(z.string()).describe("Batch IDs to aggregate summary for"),
});

export async function migrationGetBatchSummary(
  input: z.infer<typeof migrationGetBatchSummaryInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = migrationGetBatchSummaryInputSchema.parse(input);
  let totalSubmitted = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;
  let sourceDefinitionId: string | null = null;
  let targetDefinitionId: string | null = null;
  let earliestStart: string | null = null;
  let latestEnd: string | null = null;

  for (const batchId of validated.batchIds) {
    // Get statistics
    const statsParams = new URLSearchParams({ batchId });
    const statsResp = await client.get(`/engine/{engineName}/batch/statistics?${statsParams}`);
    if (!isErrorResult(statsResp)) {
      const stats = statsResp as Array<Record<string, unknown>>;
      const stat = stats[0];
      if (stat) {
        const total = (stat["totalJobs"] as number) ?? 0;
        const failed = (stat["failedJobs"] as number) ?? 0;
        const completed = (stat["completedJobs"] as number) ?? 0;
        totalSubmitted += total;
        totalFailed += failed;
        totalSucceeded += Math.max(0, completed - failed);
      }
    }

    // Get historic batch for timing and definition IDs
    const histResp = await client.get(`/engine/{engineName}/history/batch/${batchId}`);
    if (!isErrorResult(histResp)) {
      const hist = histResp as Record<string, unknown>;
      const st = hist["startTime"] as string | null;
      const et = hist["endTime"] as string | null;
      if (st && (!earliestStart || st < earliestStart)) earliestStart = st;
      if (et && (!latestEnd || et > latestEnd)) latestEnd = et;
    }
  }

  return ok({
    sourceDefinitionId,
    targetDefinitionId,
    totalSubmitted,
    succeeded: totalSucceeded,
    failed: totalFailed,
    failureBreakdown: [],
    duration: earliestStart && latestEnd
      ? `${new Date(latestEnd).getTime() - new Date(earliestStart).getTime()}ms`
      : null,
    startTime: earliestStart,
    endTime: latestEnd,
  });
}

// ── migration_listAuditEntries ────────────────────────────────────────────────

export const migrationListAuditEntriesInputSchema = z.object({
  processDefinitionKey: z.string().optional().describe("Filter by process definition key"),
  startedAfter: z.string().optional().describe("Filter entries after this date-time (ISO 8601)"),
  startedBefore: z.string().optional().describe("Filter entries before this date-time (ISO 8601)"),
  maxResults: z.number().optional().describe("Maximum number of entries (default: 50)"),
});

export async function migrationListAuditEntries(
  input: z.infer<typeof migrationListAuditEntriesInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = migrationListAuditEntriesInputSchema.parse(input);
  const params = new URLSearchParams({ operationType: "Migrate" });
  if (validated.processDefinitionKey) params.set("processDefinitionKey", validated.processDefinitionKey);
  if (validated.startedAfter) params.set("timestampAfter", validated.startedAfter);
  if (validated.startedBefore) params.set("timestampBefore", validated.startedBefore);
  params.set("maxResults", String(validated.maxResults ?? 50));

  const resp = await client.get(`/engine/{engineName}/history/user-operation?${params}`);
  if (isErrorResult(resp)) return resp;

  const entries = resp as Array<Record<string, unknown>>;
  const mapped = entries.map((e) => ({
    operatorId: e["userId"],
    timestamp: e["timestamp"],
    operationType: e["operationType"],
    entityType: e["entityType"],
    outcome: "completed",
    raw: e,
  }));

  return ok({ entries: mapped, totalCount: mapped.length });
}

// ── Story 12.6: Historic Batch Access ───────────────────────────────────────

export const migrationListHistoricBatchesInputSchema = z.object({
  completed: z.boolean().optional().describe("Filter by completion status"),
  startedAfter: z.string().optional().describe("Filter batches started after this date-time (ISO 8601)"),
  startedBefore: z.string().optional().describe("Filter batches started before this date-time (ISO 8601)"),
  maxResults: z.number().optional().describe("Maximum number of results (default: 50)"),
});

export async function migrationListHistoricBatches(
  input: z.infer<typeof migrationListHistoricBatchesInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = migrationListHistoricBatchesInputSchema.parse(input);
  const params = new URLSearchParams({ type: "MIGRATE_PROCESS_INSTANCE" });
  if (validated.completed !== undefined) params.set("completed", String(validated.completed));
  if (validated.startedAfter) params.set("startedAfter", validated.startedAfter);
  if (validated.startedBefore) params.set("startedBefore", validated.startedBefore);
  params.set("maxResults", String(validated.maxResults ?? 50));

  const resp = await client.get(`/engine/{engineName}/history/batch?${params}`);
  if (isErrorResult(resp)) return resp;
  return ok(resp);
}
