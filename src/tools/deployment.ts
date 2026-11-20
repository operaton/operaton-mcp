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

// frMapping: FR-01
import { z } from "zod";
import type { OperatonClient } from "../http/client.js";

const commonDeploymentFields = {
  "deployment-name": z.string().describe("Name for this deployment (e.g. 'loan-approval-v2')"),
  "deployment-source": z.string().optional().describe("Source identifier for this deployment (e.g. 'git', 'manual')"),
  "tenant-id": z.string().optional().describe("Tenant ID for multi-tenant deployments"),
};

export const deploymentCreateInputSchema = z.object({
  "deployment-name": commonDeploymentFields["deployment-name"],
  "bpmn-content": z.string().describe("BPMN 2.0 XML content as a string"),
  "bpmn-filename": z.string().optional().describe("Filename for the BPMN resource (default: process.bpmn)"),
  "deployment-source": commonDeploymentFields["deployment-source"],
  "tenant-id": commonDeploymentFields["tenant-id"],
});

export const decisionDeployInputSchema = z.object({
  "deployment-name": commonDeploymentFields["deployment-name"],
  "dmn-content": z.string().describe("DMN 1.3 XML content as a string"),
  "dmn-filename": z.string().optional().describe("Filename for the DMN resource (default: decision.dmn)"),
  "deployment-source": commonDeploymentFields["deployment-source"],
  "tenant-id": commonDeploymentFields["tenant-id"],
});

type ToolResult = { isError?: boolean; content: Array<{ type: "text"; text: string }> };

async function deployResource(
  client: OperatonClient,
  options: {
    deploymentName: string;
    deploymentSource?: string;
    tenantId?: string;
    filename: string;
    content: string;
  },
): Promise<ToolResult> {
  const fields: Record<string, string> = { "deployment-name": options.deploymentName };
  if (options.deploymentSource) {
    fields["deployment-source"] = options.deploymentSource;
  }
  if (options.tenantId) {
    fields["tenant-id"] = options.tenantId;
  }

  const response = await client.postMultipart("/engine/{engineName}/deployment/create", {
    fields,
    files: [{ name: options.filename, filename: options.filename, content: options.content }],
  });

  if (response !== null && typeof response === "object" && "isError" in response) {
    return response as ToolResult;
  }
  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
  };
}

export async function deploymentCreate(
  input: z.infer<typeof deploymentCreateInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = deploymentCreateInputSchema.parse(input);
  return deployResource(client, {
    deploymentName: validated["deployment-name"],
    deploymentSource: validated["deployment-source"],
    tenantId: validated["tenant-id"],
    filename: validated["bpmn-filename"] ?? "process.bpmn",
    content: validated["bpmn-content"],
  });
}

export async function decisionDeploy(
  input: z.infer<typeof decisionDeployInputSchema>,
  client: OperatonClient,
): Promise<ToolResult> {
  const validated = decisionDeployInputSchema.parse(input);
  return deployResource(client, {
    deploymentName: validated["deployment-name"],
    deploymentSource: validated["deployment-source"],
    tenantId: validated["tenant-id"],
    filename: validated["dmn-filename"] ?? "decision.dmn",
    content: validated["dmn-content"],
  });
}
