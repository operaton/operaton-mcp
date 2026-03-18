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

export interface McpToolError {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
}

interface ErrorEntry {
  hint: string;
}

const ERROR_MAP: Record<string, ErrorEntry> = {
  ProcessEngineException: {
    hint: "Check process engine state and verify the process definition is deployed and active",
  },
  InvalidRequestException: {
    hint: "Validate request parameters against the Operaton REST API documentation",
  },
  AuthorizationException: {
    hint: "Verify the user has the required permissions for this resource or operation",
  },
  UserAlreadyExistsException: {
    hint: "Choose a different user ID — this ID is already taken",
  },
  NotFoundException: {
    hint: "Verify the resource ID exists and has not been deleted or completed",
  },
  MembershipNotFoundException: {
    hint: "The user is not a member of this group",
  },
  TaskAlreadyClaimedException: {
    hint: "Unclaim the task first using the unclaim operation before assigning to another user",
  },
  BadUserRequestException: {
    hint: "Check request parameters and ensure all required fields are valid",
  },
  ParseException: {
    hint: "Validate BPMN/DMN XML syntax — check for malformed tags, missing required attributes, or invalid namespace declarations",
  },
  DeploymentResourceNotFoundException: {
    hint: "Verify the deployment resource name and deployment ID are correct",
  },
  ProcessDefinitionNotFoundException: {
    hint: "Verify the process definition ID or key exists and is spelled correctly",
  },
  DeletionFailedException: {
    hint: "Suspend or delete all active process instances for this definition before deleting",
  },
  SuspendedEntityInteractionException: {
    hint: "Resume the process definition or instance before performing this operation",
  },
  DecisionDefinitionNotFoundException: {
    hint: "Check the decision definition key is correct and the DMN is deployed",
  },
  DecisionEvaluationException: {
    hint: "Verify input variables match the decision table's input definitions",
  },
  auth_error: {
    hint: "Verify the OIDC token URL, client credentials, and identity provider availability",
  },
  __unknown__: {
    hint: "Check Operaton server logs for more details on this error",
  },
};

function resolveHint(errorType: string, message: string): string {
  // Defensive check: ensure message is a valid string before regex matching
  if (!message || typeof message !== "string") {
    return (ERROR_MAP[errorType] ?? ERROR_MAP["__unknown__"]).hint;
  }

  // Dynamic hints based on error message patterns
  if (
    (errorType === "InvalidRequestException" ||
      errorType === "UserAlreadyExistsException") &&
    /already exists|already taken|duplicate/i.test(message)
  ) {
    return "Choose a different user ID — this ID is already taken";
  }

  if (
    (errorType === "MembershipNotFoundException" ||
      errorType === "NotFoundException" ||
      errorType === "InvalidRequestException") &&
    /member/i.test(message)
  ) {
    return "The user is not a member of this group";
  }

  // Fall back to static hints from ERROR_MAP
  return (ERROR_MAP[errorType] ?? ERROR_MAP["__unknown__"]).hint;
}

export function normalize(errorBody: unknown): McpToolError {
  let errorType = "__unknown__";
  let message = "Unknown error";
  let rawBody = "";

  if (typeof errorBody === "object" && errorBody !== null) {
    const body = errorBody as Record<string, unknown>;
    if (typeof body["type"] === "string") {
      errorType = body["type"];
    }
    if (typeof body["message"] === "string") {
      message = body["message"];
    } else if (typeof body["cause"] === "string") {
      message = body["cause"];
    } else {
      rawBody = JSON.stringify(errorBody);
    }
  } else {
    rawBody = String(errorBody);
    message = rawBody;
  }

  const hint = resolveHint(errorType, message);
  const text =
    rawBody && errorType === "__unknown__"
      ? `[${errorType}] ${rawBody} — Suggested action: ${hint}`
      : `[${errorType}] ${message} — Suggested action: ${hint}`;

  return { isError: true, content: [{ type: "text", text }] };
}
