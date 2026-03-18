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

// Unit tests for Epic 12: Process Instance Migration tools

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OperatonClient } from "../../../src/http/client.js";
import {
  extractActivityIds,
  processInstanceListMigratable,
  processDefinitionGetMigrationCandidates,
  migrationGeneratePlan,
  migrationValidatePlan,
  migrationExecuteBatch,
  migrationSuspendBatch,
  migrationResumeBatch,
  migrationDeleteBatch,
  migrationListBatches,
  migrationAwaitBatch,
  migrationGetBatchStatus,
  migrationGetBatchFailures,
  migrationRetryFailedJobs,
  migrationGetBatchSummary,
  migrationListAuditEntries,
  migrationListHistoricBatches,
} from "../../../src/tools/migration.js";

// ── BPMN extraction ──────────────────────────────────────────────────────────

describe("extractActivityIds", () => {
  it("extracts userTask and serviceTask IDs from BPMN XML", () => {
    const xml = `<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="myProcess">
    <bpmn:startEvent id="start1"/>
    <bpmn:userTask id="task-approve" name="Approve"/>
    <bpmn:serviceTask id="svc-notify"/>
    <bpmn:endEvent id="end1"/>
    <bpmn:sequenceFlow id="flow1" sourceRef="start1" targetRef="task-approve"/>
  </bpmn:process>
</bpmn:definitions>`;
    const ids = extractActivityIds(xml);
    expect(ids).toContain("start1");
    expect(ids).toContain("task-approve");
    expect(ids).toContain("svc-notify");
    expect(ids).toContain("end1");
    expect(ids).not.toContain("myProcess");
    expect(ids).not.toContain("flow1");
  });

  it("returns empty array for XML with no flow nodes", () => {
    const xml = `<bpmn:definitions><bpmn:process id="p1"></bpmn:process></bpmn:definitions>`;
    expect(extractActivityIds(xml)).toEqual([]);
  });

  it("deduplicates IDs if the same ID appears multiple times", () => {
    const xml = `<bpmn:userTask id="t1"/><bpmn:userTask id="t1"/>`;
    expect(extractActivityIds(xml)).toEqual(["t1"]);
  });
});

// ── Mock client factory ───────────────────────────────────────────────────────

function makeClient(overrides: Partial<OperatonClient> = {}): OperatonClient {
  return {
    get: vi.fn().mockResolvedValue(null),
    post: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(null),
    postMultipart: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function errorResult(msg = "Not found") {
  return { isError: true, content: [{ type: "text" as const, text: msg }] };
}

// ── processInstance_listMigratable ────────────────────────────────────────────

describe("processInstance_listMigratable", () => {
  it("returns instance list with eligible flag when no call activities", async () => {
    const client = makeClient({
      get: vi.fn().mockImplementation((url: string) => {
        if (url.includes("/process-instance?")) {
          return Promise.resolve([{ id: "inst-1", businessKey: "BK-1", definitionId: "pd-1", suspended: false }]);
        }
        if (url.includes("/activity-instances")) {
          return Promise.resolve({ id: "inst-1", activityType: "processInstance", childActivityInstances: [] });
        }
        return Promise.resolve(null);
      }),
    });

    const result = await processInstanceListMigratable({ processDefinitionKey: "myProcess" }, client);
    const data = JSON.parse(result.content[0]!.text) as { instances: Array<Record<string, unknown>> };
    expect(data.instances).toHaveLength(1);
    expect(data.instances[0]!["eligible"]).toBe(true);
    expect(data.instances[0]!["callActivityBlocked"]).toBe(false);
  });

  it("marks instance as blocked when call activity is found", async () => {
    const client = makeClient({
      get: vi.fn().mockImplementation((url: string) => {
        if (url.includes("/process-instance?")) {
          return Promise.resolve([{ id: "inst-2", businessKey: null, definitionId: "pd-1", suspended: false }]);
        }
        if (url.includes("/activity-instances")) {
          return Promise.resolve({
            id: "inst-2",
            activityType: "processInstance",
            childActivityInstances: [{ id: "ca-1", activityType: "callActivity", childActivityInstances: [] }],
          });
        }
        return Promise.resolve(null);
      }),
    });

    const result = await processInstanceListMigratable({ processDefinitionKey: "myProcess" }, client);
    const data = JSON.parse(result.content[0]!.text) as { instances: Array<Record<string, unknown>> };
    expect(data.instances[0]!["eligible"]).toBe(false);
    expect(data.instances[0]!["callActivityBlocked"]).toBe(true);
  });

  it("propagates error if process instance query fails", async () => {
    const client = makeClient({ get: vi.fn().mockResolvedValue(errorResult("Engine error")) });
    const result = await processInstanceListMigratable({ processDefinitionKey: "x" }, client);
    expect((result as { isError?: boolean })["isError"]).toBe(true);
  });
});

// ── processDefinition_getMigrationCandidates ──────────────────────────────────

describe("processDefinition_getMigrationCandidates", () => {
  const srcXml = `<bpmn:userTask id="task-a"/><bpmn:userTask id="task-b"/>`;
  const tgtXml = `<bpmn:userTask id="task-a"/><bpmn:serviceTask id="task-c"/>`;

  it("returns auto-mappable, unmapped source, and new target activities", async () => {
    const client = makeClient({
      get: vi.fn().mockImplementation((url: string) => {
        if (url.includes("/src-def/xml")) return Promise.resolve({ bpmn20Xml: srcXml });
        if (url.includes("/tgt-def/xml")) return Promise.resolve({ bpmn20Xml: tgtXml });
        return Promise.resolve(null);
      }),
    });

    const result = await processDefinitionGetMigrationCandidates({
      sourceProcessDefinitionId: "src-def",
      targetProcessDefinitionId: "tgt-def",
    }, client);
    const data = JSON.parse(result.content[0]!.text) as {
      autoMappable: Array<{ sourceId: string }>;
      unmappedSource: string[];
      newTarget: string[];
    };

    expect(data.autoMappable).toHaveLength(1);
    expect(data.autoMappable[0]!.sourceId).toBe("task-a");
    expect(data.unmappedSource).toContain("task-b");
    expect(data.newTarget).toContain("task-c");
  });

  it("reports instances missing required variables", async () => {
    const client = makeClient({
      get: vi.fn().mockImplementation((url: string) => {
        if (url.includes("/xml")) return Promise.resolve({ bpmn20Xml: srcXml });
        if (url.includes("/variables")) return Promise.resolve({ "amount": { value: 100 } }); // missing "approved"
        return Promise.resolve(null);
      }),
    });

    const result = await processDefinitionGetMigrationCandidates({
      sourceProcessDefinitionId: "src-def",
      targetProcessDefinitionId: "tgt-def",
      requiredVariables: ["amount", "approved"],
      instanceIds: ["inst-1"],
    }, client);
    const data = JSON.parse(result.content[0]!.text) as {
      instancesWithMissingVariables: Array<{ instanceId: string; missing: string[] }>;
    };

    expect(data.instancesWithMissingVariables).toHaveLength(1);
    expect(data.instancesWithMissingVariables[0]!.missing).toContain("approved");
    expect(data.instancesWithMissingVariables[0]!.missing).not.toContain("amount");
  });
});

// ── migration_generatePlan ────────────────────────────────────────────────────

describe("migrationGeneratePlan", () => {
  it("returns plan and unmapped activities", async () => {
    const planResponse = {
      sourceProcessDefinitionId: "src-1",
      targetProcessDefinitionId: "tgt-1",
      instructions: [{ sourceActivityIds: ["task-a"], targetActivityIds: ["task-a"] }],
    };
    const client = makeClient({
      post: vi.fn().mockResolvedValue(planResponse),
      get: vi.fn().mockImplementation((url: string) => {
        if (url.includes("/xml")) return Promise.resolve({ bpmn20Xml: `<bpmn:userTask id="task-a"/><bpmn:userTask id="task-b"/>` });
        return Promise.resolve(null);
      }),
    });

    const result = await migrationGeneratePlan({
      sourceProcessDefinitionId: "src-1",
      targetProcessDefinitionId: "tgt-1",
    }, client);
    const data = JSON.parse(result.content[0]!.text) as { plan: unknown; unmappedActivities: string[] };
    expect(data.plan).toEqual(planResponse);
    expect(data.unmappedActivities).toContain("task-b");
  });

  it("propagates error on API failure", async () => {
    const client = makeClient({ post: vi.fn().mockResolvedValue(errorResult("API error")) });
    const result = await migrationGeneratePlan({
      sourceProcessDefinitionId: "src-1",
      targetProcessDefinitionId: "tgt-1",
    }, client);
    expect((result as { isError?: boolean })["isError"]).toBe(true);
  });
});

// ── migration_validatePlan ────────────────────────────────────────────────────

describe("migrationValidatePlan", () => {
  const plan = {
    sourceProcessDefinitionId: "src-1",
    targetProcessDefinitionId: "tgt-1",
    instructions: [{ sourceActivityIds: ["task-a"], targetActivityIds: ["task-a"] }],
  };

  it("returns valid=true with empty errors on null response (all clear)", async () => {
    const client = makeClient({ post: vi.fn().mockResolvedValue(null) });
    const result = await migrationValidatePlan({ plan, instanceIds: ["inst-1"] }, client);
    const data = JSON.parse(result.content[0]!.text) as { valid: boolean; errors: unknown[] };
    expect(data.valid).toBe(true);
    expect(data.errors).toHaveLength(0);
  });

  it("sets sampledValidation=true when instanceIds.length < totalInstanceCount", async () => {
    const client = makeClient({ post: vi.fn().mockResolvedValue(null) });
    const result = await migrationValidatePlan({ plan, instanceIds: ["inst-1"], totalInstanceCount: 10 }, client);
    const data = JSON.parse(result.content[0]!.text) as { sampledValidation: boolean };
    expect(data.sampledValidation).toBe(true);
  });

  it("sets sampledValidation=false when all instances provided", async () => {
    const client = makeClient({ post: vi.fn().mockResolvedValue(null) });
    const result = await migrationValidatePlan({ plan, instanceIds: ["inst-1"], totalInstanceCount: 1 }, client);
    const data = JSON.parse(result.content[0]!.text) as { sampledValidation: boolean };
    expect(data.sampledValidation).toBe(false);
  });

  it("returns typed errors from error result", async () => {
    const client = makeClient({ post: vi.fn().mockResolvedValue(errorResult("Validation failed: activity not found")) });
    const result = await migrationValidatePlan({ plan, instanceIds: ["inst-1"] }, client);
    const data = JSON.parse(result.content[0]!.text) as { valid: boolean; errors: Array<{ type: string }> };
    expect(data.valid).toBe(false);
    expect(data.errors[0]!.type).toBe("ValidationError");
  });
});

// ── migration_executeBatch ────────────────────────────────────────────────────

describe("migrationExecuteBatch", () => {
  const plan = {
    sourceProcessDefinitionId: "src-1",
    targetProcessDefinitionId: "tgt-1",
    instructions: [{ sourceActivityIds: ["task-a"], targetActivityIds: ["task-a"] }],
  };

  it("creates a single batch when instanceIds <= batchSize", async () => {
    const client = makeClient({
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({ id: "batch-1" }),
    });

    const result = await migrationExecuteBatch({ plan, instanceIds: ["inst-1", "inst-2"] }, client);
    const data = JSON.parse(result.content[0]!.text) as { batches: unknown[]; chunked: boolean };
    expect(data.batches).toHaveLength(1);
    expect(data.chunked).toBe(false);
  });

  it("auto-chunks when instanceIds > batchSize", async () => {
    const client = makeClient({
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({ id: "batch-x" }),
    });

    const instanceIds = Array.from({ length: 5 }, (_, i) => `inst-${i}`);
    const result = await migrationExecuteBatch({ plan, instanceIds, batchSize: 2 }, client);
    const data = JSON.parse(result.content[0]!.text) as { batches: unknown[]; chunked: boolean };
    expect(data.batches).toHaveLength(3); // ceil(5/2) = 3
    expect(data.chunked).toBe(true);
  });

  it("skips instances already on target definition", async () => {
    const client = makeClient({
      get: vi.fn().mockResolvedValue([{ id: "inst-2" }]), // inst-2 already on target
      post: vi.fn().mockResolvedValue({ id: "batch-1" }),
    });

    const result = await migrationExecuteBatch({ plan, instanceIds: ["inst-1", "inst-2"] }, client);
    const data = JSON.parse(result.content[0]!.text) as { skippedCount: number };
    expect(data.skippedCount).toBe(1);
  });

  it("returns submissionErrors for failed chunks", async () => {
    const client = makeClient({
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue(errorResult("Server error")),
    });

    const result = await migrationExecuteBatch({ plan, instanceIds: ["inst-1"] }, client);
    const data = JSON.parse(result.content[0]!.text) as { submissionErrors: unknown[] };
    expect(data.submissionErrors).toHaveLength(1);
  });

  it("dryRun routes to validate endpoint and returns dryRun=true", async () => {
    const client = makeClient({
      post: vi.fn().mockResolvedValue(null),
    });

    const result = await migrationExecuteBatch({ plan, instanceIds: ["inst-1"], dryRun: true }, client);
    const data = JSON.parse(result.content[0]!.text) as { dryRun: boolean; batches: unknown[] };
    expect(data.dryRun).toBe(true);
    expect(data.batches).toHaveLength(0);
    expect((client.post as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain("validate");
  });
});

// ── migration_suspendBatch / resumeBatch / deleteBatch ───────────────────────

describe("migrationSuspendBatch", () => {
  it("calls PUT /batch/{id}/suspended with suspended=true", async () => {
    const putSpy = vi.fn().mockResolvedValue(null);
    const client = makeClient({ put: putSpy });
    const result = await migrationSuspendBatch({ batchIds: ["b1", "b2"] }, client);
    const data = JSON.parse(result.content[0]!.text) as { results: Array<{ success: boolean }> };
    expect(data.results).toHaveLength(2);
    expect(data.results.every((r) => r.success)).toBe(true);
    expect((putSpy.mock.calls[0]![1] as { suspended: boolean }).suspended).toBe(true);
  });
});

describe("migrationResumeBatch", () => {
  it("calls PUT /batch/{id}/suspended with suspended=false", async () => {
    const putSpy = vi.fn().mockResolvedValue(null);
    const client = makeClient({ put: putSpy });
    await migrationResumeBatch({ batchIds: ["b1"] }, client);
    expect((putSpy.mock.calls[0]![1] as { suspended: boolean }).suspended).toBe(false);
  });
});

describe("migrationDeleteBatch", () => {
  it("calls DELETE for each batch ID", async () => {
    const deleteSpy = vi.fn().mockResolvedValue(null);
    const client = makeClient({ delete: deleteSpy });
    const result = await migrationDeleteBatch({ batchIds: ["b1", "b2"] }, client);
    const data = JSON.parse(result.content[0]!.text) as { results: Array<{ success: boolean }> };
    expect(deleteSpy).toHaveBeenCalledTimes(2);
    expect(data.results.every((r) => r.success)).toBe(true);
  });
});

// ── migration_listBatches ─────────────────────────────────────────────────────

describe("migrationListBatches", () => {
  it("always filters by MIGRATE_PROCESS_INSTANCE type", async () => {
    const getSpy = vi.fn().mockResolvedValue([]);
    const client = makeClient({ get: getSpy });
    await migrationListBatches({}, client);
    const url = getSpy.mock.calls[0]![0] as string;
    expect(url).toContain("type=MIGRATE_PROCESS_INSTANCE");
  });

  it("passes suspended filter when provided", async () => {
    const getSpy = vi.fn().mockResolvedValue([]);
    const client = makeClient({ get: getSpy });
    await migrationListBatches({ suspended: true }, client);
    const url = getSpy.mock.calls[0]![0] as string;
    expect(url).toContain("suspended=true");
  });
});

// ── migration_awaitBatch ──────────────────────────────────────────────────────

describe("migrationAwaitBatch", () => {
  it("returns COMPLETED when all pending jobs reach 0", async () => {
    const client = makeClient({
      get: vi.fn().mockResolvedValue([{ completedJobs: 5, failedJobs: 0, remainingJobs: 0 }]),
    });
    const noSleep = vi.fn().mockResolvedValue(undefined);
    const result = await migrationAwaitBatch({ batchIds: ["b1"], timeoutSeconds: 10 }, client, noSleep);
    const data = JSON.parse(result.content[0]!.text) as { status: string; progress: { pending: number } };
    expect(data.status).toBe("COMPLETED");
    expect(data.progress.pending).toBe(0);
  });

  it("returns TIMEOUT when jobs still pending after deadline", async () => {
    // Still has remaining jobs every poll
    const client = makeClient({
      get: vi.fn().mockResolvedValue([{ completedJobs: 2, failedJobs: 0, remainingJobs: 3 }]),
    });
    // Make sleep advance time by returning immediately but we use a short timeout
    const noSleep = vi.fn().mockResolvedValue(undefined);
    const result = await migrationAwaitBatch({ batchIds: ["b1"], timeoutSeconds: 0 }, client, noSleep);
    const data = JSON.parse(result.content[0]!.text) as { status: string };
    expect(data.status).toBe("TIMEOUT");
  });
});

// ── migration_getBatchStatus ──────────────────────────────────────────────────

describe("migrationGetBatchStatus", () => {
  it("maps batch statistics to status fields", async () => {
    const client = makeClient({
      get: vi.fn().mockResolvedValue([{
        id: "b1", totalJobs: 10, jobsCreated: 10, completedJobs: 8, failedJobs: 2, suspended: false,
      }]),
    });
    const result = await migrationGetBatchStatus({ batchId: "b1" }, client);
    const data = JSON.parse(result.content[0]!.text) as {
      totalJobs: number; jobsCompleted: number; jobsFailed: number; suspended: boolean;
    };
    expect(data.totalJobs).toBe(10);
    expect(data.jobsCompleted).toBe(8);
    expect(data.jobsFailed).toBe(2);
    expect(data.suspended).toBe(false);
  });

  it("returns error message when no stats found", async () => {
    const client = makeClient({ get: vi.fn().mockResolvedValue([]) });
    const result = await migrationGetBatchStatus({ batchId: "b1" }, client);
    const data = JSON.parse(result.content[0]!.text) as { error: string };
    expect(data.error).toContain("b1");
  });
});

// ── migration_getBatchFailures ────────────────────────────────────────────────

describe("migrationGetBatchFailures", () => {
  it("returns EXHAUSTED_RETRIES for jobs with 0 retries", async () => {
    const client = makeClient({
      get: vi.fn().mockImplementation((url: string) => {
        if (url.includes("/batch/b1") && !url.includes("statistics")) {
          return Promise.resolve({ id: "b1", batchJobDefinitionId: "bjd-1" });
        }
        if (url.includes("/job?")) {
          return Promise.resolve([{ id: "job-1", retries: 0, processInstanceId: "inst-1", exceptionMessage: "Something failed" }]);
        }
        if (url.includes("/stacktrace")) {
          return Promise.resolve("at com.example.Foo.bar(Foo.java:42)");
        }
        return Promise.resolve(null);
      }),
    });

    const result = await migrationGetBatchFailures({ batchIds: ["b1"] }, client);
    const data = JSON.parse(result.content[0]!.text) as {
      failures: Array<{ failureType: string; processInstanceId: string }>;
    };
    expect(data.failures).toHaveLength(1);
    expect(data.failures[0]!.failureType).toBe("EXHAUSTED_RETRIES");
    expect(data.failures[0]!.processInstanceId).toBe("inst-1");
  });

  it("deduplicates failures across multiple batches", async () => {
    const client = makeClient({
      get: vi.fn().mockImplementation((url: string) => {
        if (url.match(/\/batch\/(b1|b2)$/)) {
          return Promise.resolve({ id: url.includes("b1") ? "b1" : "b2", batchJobDefinitionId: "bjd-same" });
        }
        if (url.includes("/job?")) {
          return Promise.resolve([{ id: "job-shared", retries: 0, processInstanceId: "inst-1", exceptionMessage: "err" }]);
        }
        if (url.includes("/stacktrace")) return Promise.resolve("stack");
        return Promise.resolve(null);
      }),
    });

    const result = await migrationGetBatchFailures({ batchIds: ["b1", "b2"] }, client);
    const data = JSON.parse(result.content[0]!.text) as { failures: unknown[]; totalCount: number };
    expect(data.totalCount).toBe(1); // deduplicated
  });
});

// ── migration_retryFailedJobs ─────────────────────────────────────────────────

describe("migrationRetryFailedJobs", () => {
  it("resets retries for failed jobs and returns count", async () => {
    const postSpy = vi.fn().mockResolvedValue({ id: "async-op" });
    const client = makeClient({
      get: vi.fn().mockImplementation((url: string) => {
        if (url.includes("/batch/b1")) return Promise.resolve({ id: "b1", batchJobDefinitionId: "bjd-1" });
        if (url.includes("/job?")) return Promise.resolve([{ id: "j1" }, { id: "j2" }]);
        return Promise.resolve(null);
      }),
      post: postSpy,
    });

    const result = await migrationRetryFailedJobs({ batchIds: ["b1"] }, client);
    const data = JSON.parse(result.content[0]!.text) as { retriedCount: number };
    expect(data.retriedCount).toBe(2);
    expect(postSpy).toHaveBeenCalledWith(
      expect.stringContaining("/job/retries"),
      expect.objectContaining({ retries: 1, jobIds: ["j1", "j2"] }),
    );
  });

  it("returns retriedCount=0 when no failed jobs exist", async () => {
    const client = makeClient({
      get: vi.fn().mockImplementation((url: string) => {
        if (url.includes("/batch/b1")) return Promise.resolve({ id: "b1", batchJobDefinitionId: "bjd-1" });
        if (url.includes("/job?")) return Promise.resolve([]);
        return Promise.resolve(null);
      }),
    });

    const result = await migrationRetryFailedJobs({ batchIds: ["b1"] }, client);
    const data = JSON.parse(result.content[0]!.text) as { retriedCount: number };
    expect(data.retriedCount).toBe(0);
  });
});

// ── migration_getBatchSummary ─────────────────────────────────────────────────

describe("migrationGetBatchSummary", () => {
  it("aggregates stats across multiple batch IDs", async () => {
    const client = makeClient({
      get: vi.fn().mockImplementation((url: string) => {
        if (url.includes("/batch/statistics")) {
          return Promise.resolve([{ totalJobs: 10, completedJobs: 9, failedJobs: 1 }]);
        }
        if (url.includes("/history/batch/")) {
          return Promise.resolve({ startTime: "2026-01-01T00:00:00Z", endTime: "2026-01-01T00:05:00Z" });
        }
        return Promise.resolve(null);
      }),
    });

    const result = await migrationGetBatchSummary({ batchIds: ["b1", "b2"] }, client);
    const data = JSON.parse(result.content[0]!.text) as { totalSubmitted: number; succeeded: number; failed: number };
    expect(data.totalSubmitted).toBe(20); // 10 * 2 batches
    expect(data.failed).toBe(2);
    expect(data.succeeded).toBe(16); // (9-1) * 2
  });
});

// ── migration_listAuditEntries ────────────────────────────────────────────────

describe("migrationListAuditEntries", () => {
  it("filters by operationType=Migrate", async () => {
    const getSpy = vi.fn().mockResolvedValue([
      { userId: "admin", timestamp: "2026-01-01T00:00:00Z", operationType: "Migrate", entityType: "ProcessInstance" },
    ]);
    const client = makeClient({ get: getSpy });
    const result = await migrationListAuditEntries({}, client);
    const url = getSpy.mock.calls[0]![0] as string;
    expect(url).toContain("operationType=Migrate");
    const data = JSON.parse(result.content[0]!.text) as { entries: Array<{ operatorId: string }> };
    expect(data.entries[0]!.operatorId).toBe("admin");
  });

  it("passes processDefinitionKey filter when provided", async () => {
    const getSpy = vi.fn().mockResolvedValue([]);
    const client = makeClient({ get: getSpy });
    await migrationListAuditEntries({ processDefinitionKey: "loan-approval" }, client);
    expect(getSpy.mock.calls[0]![0]).toContain("processDefinitionKey=loan-approval");
  });
});

// ── migration_listHistoricBatches ─────────────────────────────────────────────

describe("migrationListHistoricBatches", () => {
  it("always filters by MIGRATE_PROCESS_INSTANCE type", async () => {
    const getSpy = vi.fn().mockResolvedValue([]);
    const client = makeClient({ get: getSpy });
    await migrationListHistoricBatches({}, client);
    expect(getSpy.mock.calls[0]![0]).toContain("type=MIGRATE_PROCESS_INSTANCE");
  });

  it("passes completed filter when provided", async () => {
    const getSpy = vi.fn().mockResolvedValue([]);
    const client = makeClient({ get: getSpy });
    await migrationListHistoricBatches({ completed: true }, client);
    expect(getSpy.mock.calls[0]![0]).toContain("completed=true");
  });

  it("passes startedAfter filter when provided", async () => {
    const getSpy = vi.fn().mockResolvedValue([]);
    const client = makeClient({ get: getSpy });
    await migrationListHistoricBatches({ startedAfter: "2026-01-01T00:00:00Z" }, client);
    expect(getSpy.mock.calls[0]![0]).toContain("startedAfter=2026-01-01");
  });
});
