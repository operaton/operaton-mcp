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

// Integration tests for Story 13.1: Guard Config Schema & Startup Validation (AC: 8)
// Tests startup exit behaviour for invalid guard env vars.
// Does NOT require a live Operaton instance.

import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distEntry = resolve(__dirname, "../../dist/index.js");

function spawnWithGuardEnv(env: Record<string, string>) {
  return spawnSync(process.execPath, [distEntry], {
    env: { ...env },
    encoding: "utf-8",
    stdio: "pipe",
    timeout: 5000,
  });
}

describe("Guard startup validation (Story 13.1, AC: 8)", () => {
  it("exits non-zero with descriptive error for invalid OPERATON_GUARD value", () => {
    const result = spawnWithGuardEnv({ OPERATON_GUARD: "strict" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'Invalid OPERATON_GUARD value: "strict". Valid values: unrestricted, read-only, safe',
    );
  });

  it("exits non-zero with descriptive error for invalid OPERATON_DENY_RESOURCES entry", () => {
    const result = spawnWithGuardEnv({
      OPERATON_DENY_RESOURCES: "deployments,widgets",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'Invalid OPERATON_DENY_RESOURCES entry: "widgets"',
    );
  });

  it("exits non-zero with descriptive error for invalid OPERATON_DENY_OPS entry", () => {
    const result = spawnWithGuardEnv({
      OPERATON_DENY_OPS: "delete,invent",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'Invalid OPERATON_DENY_OPS entry: "invent"',
    );
  });
});
