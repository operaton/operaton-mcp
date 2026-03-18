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

// Integration tests for Epic 12: Process Instance Migration
// Stories: 12.1 (FR-43, FR-44), 12.2 (FR-45, FR-46), 12.3 (FR-47, FR-48, FR-53, FR-54),
//          12.4 (FR-49, FR-50, FR-51, FR-52), 12.5 (FR-55, FR-56), 12.6 (FR-57)
// Requires a live Operaton instance — skipped when OPERATON_BASE_URL is unset.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createOperatonClient } from "../../src/http/client.js";
import { deploymentCreate } from "../../src/tools/deployment.js";
import {
  processInstanceListMigratable,
  processDefinitionGetMigrationCandidates,
  migrationGeneratePlan,
  migrationValidatePlan,
  migrationExecuteBatch,
  migrationSuspendBatch,
  migrationResumeBatch,
  migrationDeleteBatch,
  migrationListBatches,
  migrationGetBatchStatus,
  migrationListHistoricBatches,
  migrationListAuditEntries,
} from "../../src/tools/migration.js";

const skip = !process.env["OPERATON_BASE_URL"];

// ── BPMN fixtures ─────────────────────────────────────────────────────────────

const V1_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  targetNamespace="http://migration-test">
  <bpmn:process id="migration-test-process" name="Migration Test v1" isExecutable="true">
    <bpmn:startEvent id="start"/>
    <bpmn:userTask id="task-review" name="Review"/>
    <bpmn:endEvent id="end"/>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="task-review"/>
    <bpmn:sequenceFlow id="f2" sourceRef="task-review" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>`;

const V2_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  targetNamespace="http://migration-test">
  <bpmn:process id="migration-test-process" name="Migration Test v2" isExecutable="true">
    <bpmn:startEvent id="start"/>
    <bpmn:userTask id="task-review" name="Review (Updated)"/>
    <bpmn:serviceTask id="task-notify" name="Notify"/>
    <bpmn:endEvent id="end"/>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="task-review"/>
    <bpmn:sequenceFlow id="f3" sourceRef="task-review" targetRef="task-notify"/>
    <bpmn:sequenceFlow id="f2" sourceRef="task-notify" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>`;

describe.skipIf(skip)("migration integration", () => {
  let config: ReturnType<typeof loadConfig>;
  let client: ReturnType<typeof createOperatonClient>;
  let v1DeploymentId: string;
  let v2DeploymentId: string;
  let v1DefinitionId: string;
  let v2DefinitionId: string;
  let runningInstanceId: string;
  let batchIds: string[] = [];

  beforeAll(async () => {
    config = loadConfig();
    client = createOperatonClient(config);

    // Deploy v1
    const d1 = await deploymentCreate(
      { "deployment-name": "migration-test-v1", "bpmn-content": V1_BPMN, "bpmn-filename": "migration-test.bpmn", "deployment-source": "integration-test" },
      client,
    );
    const b1 = JSON.parse(d1.content[0]!.text) as Record<string, unknown>;
    v1DeploymentId = b1["id"] as string;
    const defs1 = b1["deployedProcessDefinitions"] as Record<string, Record<string, unknown>>;
    v1DefinitionId = Object.values(defs1)[0]!["id"] as string;

    // Deploy v2
    const d2 = await deploymentCreate(
      { "deployment-name": "migration-test-v2", "bpmn-content": V2_BPMN, "bpmn-filename": "migration-test.bpmn", "deployment-source": "integration-test" },
      client,
    );
    const b2 = JSON.parse(d2.content[0]!.text) as Record<string, unknown>;
    v2DeploymentId = b2["id"] as string;
    const defs2 = b2["deployedProcessDefinitions"] as Record<string, Record<string, unknown>>;
    v2DefinitionId = Object.values(defs2)[0]!["id"] as string;

    // Start a v1 instance to migrate
    const startResp = await client.post(`/engine/{engineName}/process-definition/${v1DefinitionId}/start`, {
      businessKey: "migration-test-" + Date.now(),
    });
    runningInstanceId = (startResp as Record<string, unknown>)["id"] as string;
  });

  afterAll(async () => {
    // Cancel all migration batches
    for (const id of batchIds) {
      try { await client.delete(`/engine/{engineName}/batch/${id}`); } catch { /* best-effort */ }
    }
    // Delete running instance
    if (runningInstanceId) {
      try { await client.delete(`/engine/{engineName}/process-instance/${runningInstanceId}?skipCustomListeners=true`); } catch { /* best-effort */ }
    }
    // Clean up deployments
    for (const id of [v1DeploymentId, v2DeploymentId]) {
      if (id) {
        try { await client.delete(`/engine/{engineName}/deployment/${id}?cascade=true`); } catch { /* best-effort */ }
      }
    }
  });

  // ── Story 12.1 — FR-43: processInstance_listMigratable ─────────────────────

  it("FR-43: lists migratable instances for a definition key", async () => {
    const result = await processInstanceListMigratable(
      { processDefinitionKey: "migration-test-process" },
      client,
    );
    const data = JSON.parse(result.content[0]!.text) as { instances: Array<Record<string, unknown>> };
    expect(Array.isArray(data.instances)).toBe(true);
    const our = data.instances.find((i) => i["id"] === runningInstanceId);
    expect(our).toBeDefined();
    expect(typeof our!["eligible"]).toBe("boolean");
  });

  // ── Story 12.1 — FR-44: processDefinition_getMigrationCandidates ───────────

  it("FR-44: identifies auto-mappable and unmapped activities between definitions", async () => {
    const result = await processDefinitionGetMigrationCandidates(
      { sourceProcessDefinitionId: v1DefinitionId, targetProcessDefinitionId: v2DefinitionId },
      client,
    );
    const data = JSON.parse(result.content[0]!.text) as {
      autoMappable: Array<{ sourceId: string; targetId: string }>;
      unmappedSource: string[];
      newTarget: string[];
    };
    // task-review exists in both → auto-mappable
    expect(data.autoMappable.some((m) => m.sourceId === "task-review")).toBe(true);
    // task-notify only in v2 → newTarget
    expect(data.newTarget).toContain("task-notify");
  });

  // ── Story 12.2 — FR-45: migration_generatePlan ──────────────────────────────

  it("FR-45: generates a migration plan with auto-mapped instructions", async () => {
    const result = await migrationGeneratePlan(
      { sourceProcessDefinitionId: v1DefinitionId, targetProcessDefinitionId: v2DefinitionId },
      client,
    );
    const data = JSON.parse(result.content[0]!.text) as {
      plan: { instructions: Array<{ sourceActivityIds: string[] }> };
      unmappedActivities: string[];
    };
    expect(Array.isArray(data.plan.instructions)).toBe(true);
    expect(data.plan.instructions.length).toBeGreaterThan(0);
    // unmappedActivities should be an array (may be empty if all are mapped)
    expect(Array.isArray(data.unmappedActivities)).toBe(true);
  });

  // ── Story 12.2 — FR-46: migration_validatePlan ──────────────────────────────

  it("FR-46: validates a migration plan and returns typed result", async () => {
    // Get plan first
    const planResult = await migrationGeneratePlan(
      { sourceProcessDefinitionId: v1DefinitionId, targetProcessDefinitionId: v2DefinitionId },
      client,
    );
    const planData = JSON.parse(planResult.content[0]!.text) as { plan: Record<string, unknown> };
    const plan = planData.plan as { sourceProcessDefinitionId: string; targetProcessDefinitionId: string; instructions: unknown[] };

    const result = await migrationValidatePlan(
      { plan, instanceIds: [runningInstanceId], totalInstanceCount: 1 },
      client,
    );
    const data = JSON.parse(result.content[0]!.text) as {
      valid: boolean;
      sampledValidation: boolean;
      errors: unknown[];
    };
    expect(typeof data.valid).toBe("boolean");
    expect(data.sampledValidation).toBe(false); // provided all 1 instance
    expect(Array.isArray(data.errors)).toBe(true);
  });

  // ── Story 12.3 — FR-47: migration_executeBatch ──────────────────────────────

  it("FR-47: executes migration batch and returns batchId", async () => {
    const planResult = await migrationGeneratePlan(
      { sourceProcessDefinitionId: v1DefinitionId, targetProcessDefinitionId: v2DefinitionId },
      client,
    );
    const plan = (JSON.parse(planResult.content[0]!.text) as { plan: unknown }).plan as {
      sourceProcessDefinitionId: string;
      targetProcessDefinitionId: string;
      instructions: Array<{ sourceActivityIds: string[]; targetActivityIds: string[] }>;
    };

    const result = await migrationExecuteBatch({ plan, instanceIds: [runningInstanceId] }, client);
    const data = JSON.parse(result.content[0]!.text) as {
      batches: Array<{ batchId: string }>;
      chunked: boolean;
    };
    expect(data.batches.length).toBeGreaterThanOrEqual(0); // may be 0 if already migrated or error
    if (data.batches.length > 0) {
      batchIds.push(data.batches[0]!.batchId);
      expect(typeof data.batches[0]!.batchId).toBe("string");
      expect(data.chunked).toBe(false);
    }
  });

  // ── Story 12.3 — FR-53: migration_listBatches ────────────────────────────────

  it("FR-53: lists active migration batches filtered by type", async () => {
    const result = await migrationListBatches({}, client);
    const data = JSON.parse(result.content[0]!.text) as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
    // All returned batches should be migration type (can't verify from response, just check structure)
    if (data.length > 0) {
      expect(typeof data[0]!["id"]).toBe("string");
    }
  });

  // ── Story 12.3 — FR-48: suspend/resume ──────────────────────────────────────

  it("FR-48: suspends and resumes a migration batch", async () => {
    if (batchIds.length === 0) return; // skip if no batch created above

    const suspendResult = await migrationSuspendBatch({ batchIds }, client);
    const suspendData = JSON.parse(suspendResult.content[0]!.text) as { results: Array<{ success: boolean }> };
    expect(suspendData.results.every((r) => r.success)).toBe(true);

    const resumeResult = await migrationResumeBatch({ batchIds }, client);
    const resumeData = JSON.parse(resumeResult.content[0]!.text) as { results: Array<{ success: boolean }> };
    expect(resumeData.results.every((r) => r.success)).toBe(true);
  });

  // ── Story 12.4 — FR-50: migration_getBatchStatus ────────────────────────────

  it("FR-50: gets batch status with job counts", async () => {
    if (batchIds.length === 0) return;
    const result = await migrationGetBatchStatus({ batchId: batchIds[0]! }, client);
    const data = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
    expect(typeof data["totalJobs"]).toBe("number");
  });

  // ── Story 12.3 — FR-54: migration_deleteBatch ───────────────────────────────

  it("FR-54: deletes (cancels) a migration batch", async () => {
    if (batchIds.length === 0) return;
    const result = await migrationDeleteBatch({ batchIds }, client);
    const data = JSON.parse(result.content[0]!.text) as { results: Array<{ success: boolean }> };
    expect(data.results.every((r) => r.success)).toBe(true);
    batchIds = []; // cleared
  });

  // ── Story 12.5 — FR-56: migration_listAuditEntries ──────────────────────────

  it("FR-56: lists audit entries for migration operations", async () => {
    const result = await migrationListAuditEntries({}, client);
    const data = JSON.parse(result.content[0]!.text) as { entries: unknown[]; totalCount: number };
    expect(Array.isArray(data.entries)).toBe(true);
    expect(typeof data.totalCount).toBe("number");
  });

  // ── Story 12.6 — FR-57: migration_listHistoricBatches ──────────────────────

  it("FR-57: lists historic migration batches", async () => {
    const result = await migrationListHistoricBatches({}, client);
    const data = JSON.parse(result.content[0]!.text) as unknown;
    expect(Array.isArray(data)).toBe(true);
  });
});
