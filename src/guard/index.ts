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

import type { GuardConfig, OperationClass, ResourceDomain } from "../config.js";

export interface GuardViolation {
  mcpError: string;
  warnLog: string;
}

/** Op classes blocked by GUARD=safe (irreversible operations). */
const SAFE_BLOCKED: ReadonlySet<OperationClass> = new Set<OperationClass>([
  "delete",
  "deploy",
  "migrate-execute",
]);

/**
 * Check whether a tool call is permitted given the current guard configuration.
 * Returns a GuardViolation if blocked, or null if permitted.
 *
 * Precedence: OPERATON_GUARD → OPERATON_DENY_RESOURCES → OPERATON_DENY_OPS
 * (first blocking rule encountered is reported)
 */
export function checkGuard(
  toolName: string,
  domain: ResourceDomain,
  opClass: OperationClass,
  config: GuardConfig,
): GuardViolation | null {
  // Fast path: no guard configured
  if (config.mode === "unrestricted" && config.denyResources.length === 0 && config.denyOps.length === 0) {
    return null;
  }

  const ts = new Date().toISOString();

  // 1. OPERATON_GUARD check
  if (config.mode === "read-only" && opClass !== "read") {
    const mcpError = `Operation '${toolName}' is blocked by OPERATON_GUARD=read-only (blocks all mutating operations).`;
    const remediation = "To permit: set OPERATON_GUARD=unrestricted or safe";
    const warnLog = `[operaton-mcp] WARN: Blocked '${toolName}' | domain: ${domain} | op-class: ${opClass} | guard rule: OPERATON_GUARD=read-only | remediation: ${remediation} | ts: ${ts}`;
    return { mcpError, warnLog };
  }

  if (config.mode === "safe" && SAFE_BLOCKED.has(opClass)) {
    const mcpError = `Operation '${toolName}' is blocked by OPERATON_GUARD=safe (blocks irreversible op class: ${opClass}).`;
    const remediation = "To permit: set OPERATON_GUARD=unrestricted";
    const warnLog = `[operaton-mcp] WARN: Blocked '${toolName}' | domain: ${domain} | op-class: ${opClass} | guard rule: OPERATON_GUARD=safe | remediation: ${remediation} | ts: ${ts}`;
    return { mcpError, warnLog };
  }

  // 2. OPERATON_DENY_RESOURCES check
  if (config.denyResources.includes(domain)) {
    const mcpError = `Operation '${toolName}' is blocked by OPERATON_DENY_RESOURCES (domain: ${domain} is denied).`;
    const remediation = `To permit: remove ${domain} from OPERATON_DENY_RESOURCES`;
    const warnLog = `[operaton-mcp] WARN: Blocked '${toolName}' | domain: ${domain} | op-class: ${opClass} | guard rule: OPERATON_DENY_RESOURCES=${domain} | remediation: ${remediation} | ts: ${ts}`;
    return { mcpError, warnLog };
  }

  // 3. OPERATON_DENY_OPS check
  if (config.denyOps.includes(opClass)) {
    const mcpError = `Operation '${toolName}' is blocked by OPERATON_DENY_OPS (op class: ${opClass} is denied).`;
    const remediation = `To permit: remove ${opClass} from OPERATON_DENY_OPS`;
    const warnLog = `[operaton-mcp] WARN: Blocked '${toolName}' | domain: ${domain} | op-class: ${opClass} | guard rule: OPERATON_DENY_OPS=${opClass} | remediation: ${remediation} | ts: ${ts}`;
    return { mcpError, warnLog };
  }

  return null;
}
