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

// Issue #114: generated tools must model their JSON request bodies
import { describe, it, expect, beforeAll, vi } from "vitest";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { z } from "zod";
import { jsonSchemaToZod, type JsonSchema } from "../../../scripts/json-schema-to-zod.js";
import type { OperatonClient } from "../../../src/http/client.js";
import { advertisedProperties } from "../../../src/tool-schema.js";

const ROOT = join(__dirname, "../../..");

interface SpecOp {
  operationId: string;
  parameters?: Array<{ name: string; in: string }>;
  requestBody?: { content?: Record<string, { schema?: JsonSchema }> };
}

const spec = JSON.parse(readFileSync(join(ROOT, "resources/operaton-rest-api.json"), "utf8")) as {
  paths: Record<string, Record<string, SpecOp>>;
  components: { schemas: Record<string, JsonSchema> };
};
const manifest = JSON.parse(readFileSync(join(ROOT, "config/tool-manifest.json"), "utf8")) as Record<
  string,
  { expose: boolean; tags: string[]; name: string }
>;
const components = spec.components.schemas;

/** Top-level property names of a body schema, following $ref and allOf. */
function bodyPropertyNames(schema: JsonSchema | undefined): string[] {
  if (!schema) return [];
  if (schema.$ref) return bodyPropertyNames(components[schema.$ref.split("/").pop()!]);
  const own = Object.keys(schema.properties ?? {});
  const inherited = (schema.allOf ?? []).flatMap((s) => bodyPropertyNames(s));
  return [...own, ...inherited];
}

function compile(code: string): z.ZodTypeAny {
  return new Function("z", `return ${code};`)(z) as z.ZodTypeAny;
}

function mockClient(): OperatonClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(null),
    postMultipart: vi.fn().mockResolvedValue({}),
  };
}

describe("generated tools model request bodies (#114)", () => {
  beforeAll(() => {
    execSync("node --import tsx/esm scripts/generate.ts", { cwd: ROOT, stdio: "pipe" });
  });

  const exposedBodyOps = Object.values(spec.paths)
    .flatMap((methods) => Object.values(methods))
    .filter((op) => manifest[op.operationId]?.expose && op.requestBody?.content?.["application/json"]);

  async function jsonSchemaOf(operationId: string): Promise<Record<string, any>> {
    const group = manifest[operationId]!.tags[0];
    const url = pathToFileURL(join(ROOT, "src/generated", group!, `${operationId}.ts`)).href;
    const mod = (await import(/* @vite-ignore */ url)) as Record<string, unknown>;
    return z.toJSONSchema(mod[`${operationId}InputSchema`] as z.ZodTypeAny, {
      target: "draft-7",
      io: "input",
    }) as Record<string, any>;
  }

  it("every exposed tool declares its request body properties", async () => {
    expect(exposedBodyOps.length).toBeGreaterThan(10);
    for (const op of exposedBodyOps) {
      const json = await jsonSchemaOf(op.operationId);
      const declared = Object.keys(json.properties ?? {});
      const expected = bodyPropertyNames(op.requestBody!.content!["application/json"]!.schema);
      for (const name of expected) {
        expect(declared, `${manifest[op.operationId]!.name} is missing body property '${name}'`).toContain(name);
      }
    }
  });

  it("no generated tool schema contains $ref", async () => {
    for (const op of exposedBodyOps) {
      const json = await jsonSchemaOf(op.operationId);
      expect(JSON.stringify(json), manifest[op.operationId]!.name).not.toContain('"$ref"');
    }
  });

  it("decision_evaluate types variables as a map of typed values", async () => {
    const json = await jsonSchemaOf("evaluateDecisionByKey");
    const variables = advertisedProperties(json.properties).variables as Record<string, any>;
    expect(variables.type).toBe("object");
    expect(variables.additionalProperties.properties).toHaveProperty("value");
    expect(variables.additionalProperties.properties).toHaveProperty("type");
  });

  it("decision_evaluate sends variables as an object and keeps key out of the body", async () => {
    const { evaluateDecisionByKey } = await import("../../../src/generated/decision/evaluateDecisionByKey.js");
    const client = mockClient();
    const variables = { amount: { value: 1200, type: "Double" } };
    await evaluateDecisionByKey({ key: "invoiceClassification", variables }, client);

    expect(client.post).toHaveBeenCalledWith("/decision-definition/key/invoiceClassification/evaluate", {
      variables,
    });
  });

  it("rejects variables passed as a JSON string", async () => {
    const { evaluateDecisionByKey } = await import("../../../src/generated/decision/evaluateDecisionByKey.js");
    await expect(
      evaluateDecisionByKey({ key: "k", variables: '{"a":{"value":1}}' } as never, mockClient()),
    ).rejects.toThrow();
  });

  it("task_update keeps id as required path string when the body also has id", async () => {
    const json = await jsonSchemaOf("updateTask");
    expect(json.properties.id.type).toBe("string");
    expect(json.required).toContain("id");
    expect(json.properties).toHaveProperty("name");
  });

  it("task_update still accepts null to clear a nullable top-level field", async () => {
    const { updateTaskInputSchema } = await import("../../../src/generated/task/updateTask.js");
    expect(updateTaskInputSchema.parse({ id: "t1", assignee: null })).toEqual({ id: "t1", assignee: null });
  });

  it("tools/list advertises nullable top-level body fields with their plain type", async () => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { registerAllTools } = await import("../../../src/generated/index.js");

    const server = new McpServer({ name: "t", version: "1.0.0" });
    registerAllTools(server, mockClient(), { mode: "unrestricted", denyResources: [], denyOps: [] } as never);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const mcp = new Client({ name: "t", version: "1.0.0" });
    await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);

    const { tools } = await mcp.listTools();
    const props = (name: string) =>
      tools.find((t) => t.name === name)!.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props("decision_evaluate")["variables"]!.type).toBe("object");
    expect(props("task_update")["assignee"]!.type).toBe("string");
    for (const tool of tools) {
      for (const [name, prop] of Object.entries(tool.inputSchema.properties ?? {})) {
        expect((prop as Record<string, unknown>).anyOf, `${tool.name}.${name}`).toBeUndefined();
      }
    }
    await mcp.close();
  });

  it("passes undeclared body fields through", async () => {
    const { evaluateDecisionByKey } = await import("../../../src/generated/decision/evaluateDecisionByKey.js");
    const client = mockClient();
    await evaluateDecisionByKey({ key: "k", variables: {}, extra: 1 } as never, client);
    expect(client.post).toHaveBeenCalledWith("/decision-definition/key/k/evaluate", { variables: {}, extra: 1 });
  });
});

describe("jsonSchemaToZod", () => {
  it("terminates on cyclic $ref with z.unknown()", () => {
    const cyclic: Record<string, JsonSchema> = {
      A: { type: "object", properties: { a: { $ref: "#/components/schemas/A" } } },
    };
    const code = jsonSchemaToZod({ $ref: "#/components/schemas/A" }, cyclic);
    expect(code).toContain("z.unknown()");
    expect(() => compile(code)).not.toThrow();
  });

  it("cuts nesting deeper than 4 levels to z.unknown()", () => {
    let schema: JsonSchema = { type: "string" };
    for (let i = 0; i < 6; i++) schema = { type: "object", properties: { n: schema } };
    const code = jsonSchemaToZod(schema, {});
    expect(code).toContain("z.unknown()");
    expect(code).not.toContain("z.string()");
  });

  it("maps arrays, enums, integers, nullable and required", () => {
    const schema = compile(
      jsonSchemaToZod(
        {
          type: "object",
          required: ["ids"],
          properties: {
            ids: { type: "array", items: { type: "string" } },
            state: { type: "string", enum: ["active", "suspended"] },
            retries: { type: "integer", format: "int32" },
            due: { type: "string", nullable: true },
          },
        },
        {},
      ),
    );
    expect(schema.parse({ ids: ["a"], state: "active", retries: 3, due: null })).toEqual({
      ids: ["a"],
      state: "active",
      retries: 3,
      due: null,
    });
    expect(() => schema.parse({})).toThrow();
    expect(() => schema.parse({ ids: [], state: "other" })).toThrow();
    expect(() => schema.parse({ ids: [], retries: 1.5 })).toThrow();
  });

  it("merges allOf object members", () => {
    const comps: Record<string, JsonSchema> = {
      Base: { type: "object", properties: { retries: { type: "integer" } } },
    };
    const schema = compile(
      jsonSchemaToZod(
        { allOf: [{ type: "object", properties: { dueDate: { type: "string" } } }, { $ref: "#/components/schemas/Base" }] },
        comps,
      ),
    );
    expect(schema.parse({ dueDate: "x", retries: 1 })).toEqual({ dueDate: "x", retries: 1 });
    expect(() => schema.parse({ retries: "1" })).toThrow();
  });

  it("maps additionalProperties-only objects to records and untyped schemas to unknown", () => {
    const record = compile(jsonSchemaToZod({ type: "object", additionalProperties: { type: "boolean" } }, {}));
    expect(record.parse({ a: true })).toEqual({ a: true });
    expect(() => record.parse({ a: "x" })).toThrow();
    expect(jsonSchemaToZod({ description: "any" }, {})).toBe("z.unknown()");
  });
});
