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

import { vi, describe, it, expect } from "vitest";
import type { OperatonClient } from "../../../src/http/client.js";
import { deploymentCreate, decisionDeploy } from "../../../src/tools/deployment.js";

const BPMN = "<bpmn:definitions/>";
const DMN = "<definitions/>";
const PATH = "/engine/{engineName}/deployment/create";

function mockClient(): OperatonClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    postMultipart: vi.fn().mockResolvedValue({ id: "dep-1" }),
  };
}

describe("deploymentCreate", () => {
  it("passes BPMN as file with default filename", async () => {
    const client = mockClient();
    await deploymentCreate({ "deployment-name": "d", "bpmn-content": BPMN }, client);

    expect(client.postMultipart).toHaveBeenCalledWith(PATH, {
      fields: { "deployment-name": "d" },
      files: [{ name: "process.bpmn", filename: "process.bpmn", content: BPMN }],
    });
  });

  it("puts deployment-source and tenant-id into fields, not files", async () => {
    const client = mockClient();
    await deploymentCreate(
      {
        "deployment-name": "d",
        "bpmn-content": BPMN,
        "bpmn-filename": "order.bpmn",
        "deployment-source": "git",
        "tenant-id": "t1",
      },
      client,
    );

    expect(client.postMultipart).toHaveBeenCalledWith(PATH, {
      fields: { "deployment-name": "d", "deployment-source": "git", "tenant-id": "t1" },
      files: [{ name: "order.bpmn", filename: "order.bpmn", content: BPMN }],
    });
  });
});

describe("decisionDeploy", () => {
  it("uses DMN params and default filename decision.dmn", async () => {
    const client = mockClient();
    await decisionDeploy({ "deployment-name": "d", "dmn-content": DMN }, client);

    expect(client.postMultipart).toHaveBeenCalledWith(PATH, {
      fields: { "deployment-name": "d" },
      files: [{ name: "decision.dmn", filename: "decision.dmn", content: DMN }],
    });
  });

  it("uses the given dmn-filename", async () => {
    const client = mockClient();
    await decisionDeploy(
      { "deployment-name": "d", "dmn-content": DMN, "dmn-filename": "rules.dmn" },
      client,
    );

    expect(client.postMultipart).toHaveBeenCalledWith(PATH, {
      fields: { "deployment-name": "d" },
      files: [{ name: "rules.dmn", filename: "rules.dmn", content: DMN }],
    });
  });
});
