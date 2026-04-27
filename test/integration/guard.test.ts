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

// Integration tests for Story 13.3: Guard Integration Tests
// Covers all three guard modes, all resource domains, all operation classes.
// Skipped when OPERATON_BASE_URL is unset.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadConfig } from "../../src/config.js";
import { createOperatonClient as createClient } from "../../src/http/client.js";
import { registerAllTools } from "../../src/generated/index.js";
import type { GuardConfig, ResourceDomain, OperationClass } from "../../src/config.js";

const skip = !process.env["OPERATON_BASE_URL"];

// ── Helpers ──────────────────────────────────────────────────────────────────

type ToolCallResult = { isError?: boolean; content: Array<{ type: string; text: string }> };

/**
 * Create an in-memory MCP client+server pair with the given guard config.
 * Returns a callTool function and a teardown function.
 */
async function createMcpPair(guardConfig: GuardConfig): Promise<{
  callTool: (name: string, args?: Record<string, unknown>) => Promise<ToolCallResult>;
  teardown: () => Promise<void>;
}> {
  const config = loadConfig();
  const operatonClient = createClient(config);
  const server = new McpServer({ name: "operaton-mcp-test", version: "1.0.0" });
  registerAllTools(server, operatonClient, guardConfig);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
  await mcpClient.connect(clientTransport);
  await server.connect(serverTransport);

  const callTool = async (name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> => {
    const result = await mcpClient.callTool({ name, arguments: args });
    return result as ToolCallResult;
  };

  const teardown = async () => {
    await mcpClient.close();
  };

  return { callTool, teardown };
}

function isGuardBlocked(result: ToolCallResult, ruleSubstring: string): boolean {
  if (!result.isError) return false;
  const text = result.content[0]?.text ?? "";
  return text.includes(ruleSubstring);
}

function isNotGuardBlocked(result: ToolCallResult): boolean {
  if (!result.isError) return true;
  const text = result.content[0]?.text ?? "";
  // Not guard-blocked if the error text doesn't mention guard rules
  return !text.includes("is blocked by OPERATON_");
}

// ── Group A: Guard Mode Tests ─────────────────────────────────────────────────

describe.skipIf(skip)("Guard Integration — Group A: Guard mode tests", () => {
  // AC 1: unrestricted — all op classes pass
  describe("A1: OPERATON_GUARD=unrestricted", () => {
    let callTool: (name: string, args?: Record<string, unknown>) => Promise<ToolCallResult>;
    let teardown: () => Promise<void>;

    beforeAll(async () => {
      const guardConfig: GuardConfig = { mode: "unrestricted", denyResources: [], denyOps: [] };
      ({ callTool, teardown } = await createMcpPair(guardConfig));
    });

    afterAll(async () => { await teardown(); });

    it("read op (processInstance_list) passes without permission error", async () => {
      const result = await callTool("processInstance_list");
      expect(isNotGuardBlocked(result)).toBe(true);
    });

    it("create op (processInstance_start) passes without permission error", async () => {
      // Attempt to start a non-existent process — may fail with 404, but not guard error
      const result = await callTool("processInstance_start", { key: "__nonexistent__" });
      expect(isNotGuardBlocked(result)).toBe(true);
    });

    it("delete op (processDefinition_deleteById) passes without permission error", async () => {
      const result = await callTool("processDefinition_deleteById", { id: "__nonexistent__" });
      expect(isNotGuardBlocked(result)).toBe(true);
    });

    it("deploy op (deployment_create) passes without permission error", async () => {
      // Use invalid XML so it fails on Operaton, but not due to guard
      const result = await callTool("deployment_create", {
        "deployment-name": "guard-test",
        "bpmn-content": "<invalid/>",
        "bpmn-filename": "test.bpmn",
      });
      expect(isNotGuardBlocked(result)).toBe(true);
    });

    it("suspend-resume op (processInstance_setSuspension) passes without permission error", async () => {
      const result = await callTool("processInstance_setSuspension", {
        suspended: true,
        processInstanceId: "__nonexistent__",
      });
      expect(isNotGuardBlocked(result)).toBe(true);
    });

    it("migrate-execute op (migration_executeBatch) passes without permission error", async () => {
      const result = await callTool("migration_executeBatch", {
        migrationPlan: { sourceProcessDefinitionId: "none", targetProcessDefinitionId: "none", instructions: [] },
        processInstanceIds: [],
      });
      expect(isNotGuardBlocked(result)).toBe(true);
    });

    it("migrate-control op (migration_generatePlan) passes without permission error", async () => {
      const result = await callTool("migration_generatePlan", {
        sourceProcessDefinitionId: "__nonexistent__",
        targetProcessDefinitionId: "__nonexistent__",
      });
      expect(isNotGuardBlocked(result)).toBe(true);
    });
  });

  // AC 2: read-only — mutating call blocked, read call passes
  describe("A2: OPERATON_GUARD=read-only", () => {
    let callTool: (name: string, args?: Record<string, unknown>) => Promise<ToolCallResult>;
    let teardown: () => Promise<void>;

    beforeAll(async () => {
      const guardConfig: GuardConfig = { mode: "read-only", denyResources: [], denyOps: [] };
      ({ callTool, teardown } = await createMcpPair(guardConfig));
    });

    afterAll(async () => { await teardown(); });

    it("mutating call (processInstance_start) returns isError citing OPERATON_GUARD=read-only", async () => {
      const result = await callTool("processInstance_start", { key: "any" });
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("OPERATON_GUARD=read-only");
    });

    it("read call (processInstance_list) succeeds", async () => {
      const result = await callTool("processInstance_list");
      expect(isNotGuardBlocked(result)).toBe(true);
    });
  });

  // AC 3: safe — irreversible call blocked, reversible mutation passes
  describe("A3: OPERATON_GUARD=safe", () => {
    let callTool: (name: string, args?: Record<string, unknown>) => Promise<ToolCallResult>;
    let teardown: () => Promise<void>;

    beforeAll(async () => {
      const guardConfig: GuardConfig = { mode: "safe", denyResources: [], denyOps: [] };
      ({ callTool, teardown } = await createMcpPair(guardConfig));
    });

    afterAll(async () => { await teardown(); });

    it("irreversible call (processDefinition_deleteById) returns isError citing OPERATON_GUARD=safe", async () => {
      const result = await callTool("processDefinition_deleteById", { id: "any" });
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("OPERATON_GUARD=safe");
    });

    it("reversible mutation (processInstance_setSuspension) succeeds (no guard block)", async () => {
      const result = await callTool("processInstance_setSuspension", {
        suspended: true,
        processInstanceId: "__nonexistent__",
      });
      expect(isNotGuardBlocked(result)).toBe(true);
    });
  });
});

// ── Group B: Domain Deny Tests ────────────────────────────────────────────────

type DomainFixture = {
  domain: ResourceDomain;
  readTool: string;
  writeTool: string;
  writeArgs?: Record<string, unknown>;
  readArgs?: Record<string, unknown>;
  writeOnly?: boolean;
};

const DOMAIN_FIXTURES: DomainFixture[] = [
  { domain: "process-definitions", readTool: "processDefinition_list", writeTool: "processDefinition_deploy", writeArgs: { "deployment-name": "test", "bpmn-content": "<x/>", "bpmn-filename": "t.bpmn" } },
  { domain: "deployments", readTool: "deployment_list", writeTool: "deployment_create", writeArgs: { "deployment-name": "test", "bpmn-content": "<x/>", "bpmn-filename": "t.bpmn" } },
  { domain: "instances", readTool: "processInstance_list", writeTool: "processInstance_start", writeArgs: { key: "test" } },
  { domain: "tasks", readTool: "task_list", writeTool: "task_create", writeArgs: { name: "test" } },
  { domain: "jobs", readTool: "job_list", writeTool: "job_triggerExecution", writeArgs: { id: "test" } },
  { domain: "incidents", readTool: "incident_list", writeTool: "incident_resolve", writeArgs: { id: "test" } },
  { domain: "users-groups", readTool: "user_list", writeTool: "user_create", writeArgs: { id: "test-user", profile: { id: "test-user", firstName: "Test", lastName: "User", email: "test@test.com" }, credentials: { password: "test" } } },
  { domain: "decisions", readTool: "decision_list", writeTool: "decision_deploy", writeArgs: { "deployment-name": "test", "bpmn-content": "<x/>", "bpmn-filename": "t.dmn" } },
  { domain: "migrations", readTool: "migration_listBatches", writeTool: "migration_executeBatch", writeArgs: { migrationPlan: { sourceProcessDefinitionId: "s", targetProcessDefinitionId: "t", instructions: [] }, processInstanceIds: [] } },
  // infrastructure: all tools are reads (history queries); verify read is blocked
  { domain: "infrastructure", readTool: "history_listProcessInstances", writeTool: "history_listProcessInstances", writeOnly: true },
];

describe.skipIf(skip)("Guard Integration — Group B: Domain deny tests", () => {
  it.each(DOMAIN_FIXTURES)("DENY_RESOURCES=$domain blocks calls in that domain", async ({ domain, readTool, writeTool, writeArgs, readArgs, writeOnly }) => {
    const guardConfig: GuardConfig = { mode: "unrestricted", denyResources: [domain], denyOps: [] };
    const { callTool, teardown } = await createMcpPair(guardConfig);
    try {
      // Write tool in denied domain must be blocked
      const writeResult = await callTool(writeTool, writeArgs ?? {});
      expect(writeResult.isError).toBe(true);
      expect(writeResult.content[0]?.text).toContain(`OPERATON_DENY_RESOURCES`);
      expect(writeResult.content[0]?.text).toContain(domain);

      if (!writeOnly) {
        // Read tool in denied domain must also be blocked
        const readResult = await callTool(readTool, readArgs ?? {});
        expect(readResult.isError).toBe(true);
        expect(readResult.content[0]?.text).toContain(`OPERATON_DENY_RESOURCES`);
        expect(readResult.content[0]?.text).toContain(domain);
      }

      // A call against a different domain must NOT be blocked by the guard rule
      // Use processInstance_list (domain: instances) unless that's the domain under test
      const unaffectedTool = domain === "instances" ? "processDefinition_list" : "processInstance_list";
      const unaffectedResult = await callTool(unaffectedTool);
      expect(isNotGuardBlocked(unaffectedResult)).toBe(true);
    } finally {
      await teardown();
    }
  });
});

// ── Group C: Op-Class Deny Tests ──────────────────────────────────────────────

type OpClassFixture = {
  opClass: OperationClass;
  tool: string;
  toolArgs?: Record<string, unknown>;
  passTool: string;
  passArgs?: Record<string, unknown>;
};

const OP_CLASS_FIXTURES: OpClassFixture[] = [
  { opClass: "read", tool: "processInstance_list", passTool: "user_create", passArgs: { id: "t", profile: { id: "t", firstName: "T", lastName: "U", email: "t@t.com" }, credentials: { password: "t" } } },
  { opClass: "create", tool: "user_create", toolArgs: { id: "t", profile: { id: "t", firstName: "T", lastName: "U", email: "t@t.com" }, credentials: { password: "t" } }, passTool: "processInstance_list" },
  { opClass: "update", tool: "task_update", toolArgs: { id: "test" }, passTool: "processInstance_list" },
  { opClass: "delete", tool: "processDefinition_deleteById", toolArgs: { id: "test" }, passTool: "processInstance_list" },
  { opClass: "suspend-resume", tool: "processInstance_setSuspension", toolArgs: { suspended: true, processInstanceId: "test" }, passTool: "processInstance_list" },
  { opClass: "deploy", tool: "deployment_create", toolArgs: { "deployment-name": "t", "bpmn-content": "<x/>", "bpmn-filename": "t.bpmn" }, passTool: "processInstance_list" },
  { opClass: "migrate-execute", tool: "migration_executeBatch", toolArgs: { migrationPlan: { sourceProcessDefinitionId: "s", targetProcessDefinitionId: "t", instructions: [] }, processInstanceIds: [] }, passTool: "processInstance_list" },
  { opClass: "migrate-control", tool: "migration_generatePlan", toolArgs: { sourceProcessDefinitionId: "s", targetProcessDefinitionId: "t" }, passTool: "processInstance_list" },
];

describe.skipIf(skip)("Guard Integration — Group C: Op-class deny tests", () => {
  it.each(OP_CLASS_FIXTURES)("DENY_OPS=$opClass blocks $tool and permits $passTool", async ({ opClass, tool, toolArgs, passTool, passArgs }) => {
    const guardConfig: GuardConfig = { mode: "unrestricted", denyResources: [], denyOps: [opClass] };
    const { callTool, teardown } = await createMcpPair(guardConfig);
    try {
      // Representative tool for denied op class must be blocked
      const blockedResult = await callTool(tool, toolArgs ?? {});
      expect(blockedResult.isError).toBe(true);
      expect(blockedResult.content[0]?.text).toContain("OPERATON_DENY_OPS");
      expect(blockedResult.content[0]?.text).toContain(opClass);

      // A different op class on a different tool must NOT be blocked by this rule
      const passResult = await callTool(passTool, passArgs ?? {});
      expect(isNotGuardBlocked(passResult)).toBe(true);
    } finally {
      await teardown();
    }
  });
});

// ── AC 6: generate pipeline passes ───────────────────────────────────────────
// This is verified by the build system running npm run generate without errors.
// The unit test in guard.test.ts and the generate.ts assertions cover this.
