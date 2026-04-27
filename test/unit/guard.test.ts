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

import { describe, it, expect } from "vitest";
import { checkGuard } from "../../src/guard/index.js";
import type { GuardConfig } from "../../src/config.js";

const UNRESTRICTED: GuardConfig = { mode: "unrestricted", denyResources: [], denyOps: [] };

describe("checkGuard", () => {
  // AC 11: no-guard pass-through
  it("returns null when no guard is configured (unrestricted, no deny lists)", () => {
    const result = checkGuard("processInstance_list", "instances", "read", UNRESTRICTED);
    expect(result).toBeNull();
  });

  it("returns null for any op class when mode=unrestricted and no deny lists", () => {
    const config: GuardConfig = { mode: "unrestricted", denyResources: [], denyOps: [] };
    expect(checkGuard("processInstance_start", "instances", "create", config)).toBeNull();
    expect(checkGuard("processDefinition_deleteById", "process-definitions", "delete", config)).toBeNull();
    expect(checkGuard("deployment_create", "deployments", "deploy", config)).toBeNull();
  });

  // AC 2, AC 11: GUARD=read-only blocks mutating ops
  it("blocks non-read op when GUARD=read-only", () => {
    const config: GuardConfig = { mode: "read-only", denyResources: [], denyOps: [] };
    const result = checkGuard("processInstance_start", "instances", "create", config);
    expect(result).not.toBeNull();
    expect(result!.mcpError).toBe(
      "Operation 'processInstance_start' is blocked by OPERATON_GUARD=read-only (blocks all mutating operations).",
    );
    expect(result!.warnLog).toContain("OPERATON_GUARD=read-only");
    expect(result!.warnLog).toContain("processInstance_start");
    expect(result!.warnLog).toContain("To permit: set OPERATON_GUARD=unrestricted or safe");
  });

  it("permits read op when GUARD=read-only", () => {
    const config: GuardConfig = { mode: "read-only", denyResources: [], denyOps: [] };
    expect(checkGuard("processInstance_list", "instances", "read", config)).toBeNull();
  });

  // AC 3, AC 11: GUARD=safe blocks irreversible op classes
  it("blocks delete op when GUARD=safe", () => {
    const config: GuardConfig = { mode: "safe", denyResources: [], denyOps: [] };
    const result = checkGuard("processDefinition_delete", "process-definitions", "delete", config);
    expect(result).not.toBeNull();
    expect(result!.mcpError).toBe(
      "Operation 'processDefinition_delete' is blocked by OPERATON_GUARD=safe (blocks irreversible op class: delete).",
    );
    expect(result!.warnLog).toContain("OPERATON_GUARD=safe");
    expect(result!.warnLog).toContain("To permit: set OPERATON_GUARD=unrestricted");
  });

  it("blocks deploy op when GUARD=safe", () => {
    const config: GuardConfig = { mode: "safe", denyResources: [], denyOps: [] };
    const result = checkGuard("deployment_create", "deployments", "deploy", config);
    expect(result).not.toBeNull();
    expect(result!.mcpError).toContain("blocks irreversible op class: deploy");
  });

  it("blocks migrate-execute op when GUARD=safe", () => {
    const config: GuardConfig = { mode: "safe", denyResources: [], denyOps: [] };
    const result = checkGuard("migration_executeBatch", "migrations", "migrate-execute", config);
    expect(result).not.toBeNull();
    expect(result!.mcpError).toContain("blocks irreversible op class: migrate-execute");
  });

  // AC 4, AC 11: GUARD=safe permits reversible mutations
  it("permits suspend-resume op when GUARD=safe", () => {
    const config: GuardConfig = { mode: "safe", denyResources: [], denyOps: [] };
    expect(checkGuard("processInstance_setSuspension", "instances", "suspend-resume", config)).toBeNull();
  });

  it("permits create op when GUARD=safe", () => {
    const config: GuardConfig = { mode: "safe", denyResources: [], denyOps: [] };
    expect(checkGuard("processInstance_start", "instances", "create", config)).toBeNull();
  });

  it("permits update op when GUARD=safe", () => {
    const config: GuardConfig = { mode: "safe", denyResources: [], denyOps: [] };
    expect(checkGuard("task_update", "tasks", "update", config)).toBeNull();
  });

  it("permits migrate-control op when GUARD=safe", () => {
    const config: GuardConfig = { mode: "safe", denyResources: [], denyOps: [] };
    expect(checkGuard("migration_generatePlan", "migrations", "migrate-control", config)).toBeNull();
  });

  // AC 5, AC 11: DENY_RESOURCES blocks tool in denied domain
  it("blocks read and write in denied domain when DENY_RESOURCES is set", () => {
    const config: GuardConfig = { mode: "unrestricted", denyResources: ["users-groups"], denyOps: [] };
    const readResult = checkGuard("user_list", "users-groups", "read", config);
    expect(readResult).not.toBeNull();
    expect(readResult!.mcpError).toBe(
      "Operation 'user_list' is blocked by OPERATON_DENY_RESOURCES (domain: users-groups is denied).",
    );
    expect(readResult!.warnLog).toContain("OPERATON_DENY_RESOURCES=users-groups");
    expect(readResult!.warnLog).toContain("To permit: remove users-groups from OPERATON_DENY_RESOURCES");

    const writeResult = checkGuard("user_create", "users-groups", "create", config);
    expect(writeResult).not.toBeNull();
    expect(writeResult!.mcpError).toContain("domain: users-groups is denied");
  });

  it("permits tool in non-denied domain when DENY_RESOURCES is set", () => {
    const config: GuardConfig = { mode: "unrestricted", denyResources: ["users-groups"], denyOps: [] };
    expect(checkGuard("processInstance_list", "instances", "read", config)).toBeNull();
  });

  // AC 6, AC 11: DENY_OPS blocks specific op class
  it("blocks tool of denied op class when DENY_OPS is set", () => {
    const config: GuardConfig = { mode: "unrestricted", denyResources: [], denyOps: ["delete"] };
    const result = checkGuard("processDefinition_deleteById", "process-definitions", "delete", config);
    expect(result).not.toBeNull();
    expect(result!.mcpError).toBe(
      "Operation 'processDefinition_deleteById' is blocked by OPERATON_DENY_OPS (op class: delete is denied).",
    );
    expect(result!.warnLog).toContain("OPERATON_DENY_OPS=delete");
    expect(result!.warnLog).toContain("To permit: remove delete from OPERATON_DENY_OPS");
  });

  it("permits different op class when DENY_OPS blocks only one class", () => {
    const config: GuardConfig = { mode: "unrestricted", denyResources: [], denyOps: ["delete"] };
    expect(checkGuard("processDefinition_list", "process-definitions", "read", config)).toBeNull();
  });

  // AC 7, AC 11: precedence — DENY_OPS wins over GUARD=safe for reversible op
  it("DENY_OPS wins over GUARD=safe for a reversible op blocked by DENY_OPS", () => {
    const config: GuardConfig = { mode: "safe", denyResources: [], denyOps: ["suspend-resume"] };
    // suspend-resume is reversible (not blocked by safe), but DENY_OPS blocks it
    const result = checkGuard("processInstance_setSuspension", "instances", "suspend-resume", config);
    expect(result).not.toBeNull();
    // Should cite DENY_OPS, not GUARD=safe
    expect(result!.mcpError).toContain("OPERATON_DENY_OPS");
    expect(result!.mcpError).not.toContain("OPERATON_GUARD=safe");
  });

  // AC 11: MCP error format — no remediation in error body
  it("MCP error contains op name and blocking rule only, no remediation hint", () => {
    const config: GuardConfig = { mode: "read-only", denyResources: [], denyOps: [] };
    const result = checkGuard("processInstance_start", "instances", "create", config);
    expect(result).not.toBeNull();
    // Remediation should NOT appear in the mcpError
    expect(result!.mcpError).not.toContain("To permit");
    expect(result!.mcpError).not.toContain("remediation");
  });

  // AC 8, AC 11: WARN log format includes full detail with remediation
  it("WARN log contains full detail including remediation hint", () => {
    const config: GuardConfig = { mode: "read-only", denyResources: [], denyOps: [] };
    const result = checkGuard("processInstance_start", "instances", "create", config);
    expect(result).not.toBeNull();
    const log = result!.warnLog;
    expect(log).toMatch(/^\[operaton-mcp\] WARN: Blocked 'processInstance_start'/);
    expect(log).toContain("| domain: instances |");
    expect(log).toContain("| op-class: create |");
    expect(log).toContain("| guard rule: OPERATON_GUARD=read-only |");
    expect(log).toContain("| remediation:");
    expect(log).toContain("| ts:");
  });
});
