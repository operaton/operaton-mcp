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

// Issues #113 and #114 end to end: MCP tools/list + tools/call against a live engine.
// Requires a live Operaton instance — skipped when OPERATON_BASE_URL is unset
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadConfig } from "../../src/config.js";
import { createOperatonClient, type OperatonClient } from "../../src/http/client.js";
import { registerAllTools } from "../../src/generated/index.js";

const SMOKE_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Defs" targetNamespace="http://example.com">
  <bpmn:process id="mcpSmokeTest" isExecutable="true" operaton:historyTimeToLive="P1D" xmlns:operaton="http://operaton.org/schema/1.0/bpmn">
    <bpmn:startEvent id="start" />
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="task" />
    <bpmn:userTask id="task" />
    <bpmn:sequenceFlow id="f2" sourceRef="task" targetRef="end" />
    <bpmn:endEvent id="end" />
  </bpmn:process>
</bpmn:definitions>`;

const AMOUNT_DMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:operaton="http://operaton.org/schema/1.0/dmn"
             id="mcpAmount" name="Amount" namespace="http://test">
  <decision id="mcpAmountClass" name="Amount Class" operaton:historyTimeToLive="P1D">
    <decisionTable id="dt1" hitPolicy="FIRST">
      <input id="input1" label="Amount">
        <inputExpression id="expr1" typeRef="double"><text>amount</text></inputExpression>
      </input>
      <output id="output1" name="large" typeRef="boolean"/>
      <rule id="rule1">
        <inputEntry id="ie1"><text>&gt;= 1000</text></inputEntry>
        <outputEntry id="oe1"><text>true</text></outputEntry>
      </rule>
      <rule id="rule2">
        <inputEntry id="ie2"><text>&lt; 1000</text></inputEntry>
        <outputEntry id="oe2"><text>false</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

const skip = !process.env["OPERATON_BASE_URL"];

type CallResult = { isError?: boolean; content: Array<{ type: string; text: string }> };

describe.skipIf(skip)("deploy and evaluate via MCP (#113, #114)", () => {
  let mcp: Client;
  let operaton: OperatonClient;
  const deploymentIds: string[] = [];

  async function call(name: string, args: Record<string, unknown>): Promise<CallResult> {
    return (await mcp.callTool({ name, arguments: args })) as CallResult;
  }

  async function deploy(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const result = await call(name, args);
    expect(result.isError, result.content[0]?.text).toBeFalsy();
    const body = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
    deploymentIds.push(body["id"] as string);
    return body;
  }

  beforeAll(async () => {
    const config = loadConfig();
    operaton = createOperatonClient(config);
    const server = new McpServer({ name: "operaton-mcp", version: "1.0.0" });
    registerAllTools(server, operaton, config.guard);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    mcp = new Client({ name: "integration-client", version: "1.0.0" });
    await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);
  });

  afterEach(async () => {
    for (const id of deploymentIds.splice(0)) {
      await operaton.delete(`/engine/{engineName}/deployment/${id}?cascade=true`);
    }
  });

  afterAll(async () => {
    await mcp.close();
  });

  it("deployment_create deploys a BPMN resource", async () => {
    const body = await deploy("deployment_create", {
      "deployment-name": "mcp-smoke-test",
      "bpmn-filename": "mcpSmokeTest.bpmn",
      "bpmn-content": SMOKE_BPMN,
    });
    const defs = body["deployedProcessDefinitions"] as Record<string, { key: string }>;
    expect(Object.values(defs).map((d) => d.key)).toEqual(["mcpSmokeTest"]);
  });

  it("processDefinition_deploy deploys with the default filename", async () => {
    const body = await deploy("processDefinition_deploy", {
      "deployment-name": "mcp-smoke-test-default",
      "bpmn-content": SMOKE_BPMN,
    });
    expect(Object.keys(body["deployedProcessDefinitions"] as object)).toHaveLength(1);
  });

  it("decision_deploy deploys a DMN resource", async () => {
    const body = await deploy("decision_deploy", {
      "deployment-name": "mcp-dmn-test",
      "dmn-content": AMOUNT_DMN,
    });
    const defs = body["deployedDecisionDefinitions"] as Record<string, { key: string }>;
    expect(Object.values(defs).map((d) => d.key)).toEqual(["mcpAmountClass"]);
  });

  it("tools/list advertises decision_evaluate variables as an object", async () => {
    const { tools } = await mcp.listTools();
    const evaluate = tools.find((t) => t.name === "decision_evaluate")!;
    const variables = (evaluate.inputSchema.properties as Record<string, { type?: string }>)["variables"];
    expect(variables?.type).toBe("object");
  });

  it("decision_evaluate evaluates with a variables object", async () => {
    await deploy("decision_deploy", { "deployment-name": "mcp-dmn-eval", "dmn-content": AMOUNT_DMN });

    const result = await call("decision_evaluate", {
      key: "mcpAmountClass",
      variables: { amount: { value: 1200, type: "Double" } },
    });

    expect(result.isError, result.content[0]?.text).toBeFalsy();
    const rows = JSON.parse(result.content[0]!.text) as Array<Record<string, { value: unknown }>>;
    expect(rows[0]!["large"]!.value).toBe(true);
  });
});
