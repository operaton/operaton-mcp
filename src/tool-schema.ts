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

type JsonSchemaNode = Record<string, unknown>;

function withoutNull(property: JsonSchemaNode): JsonSchemaNode {
  const { anyOf, type, ...rest } = property;
  if (Array.isArray(type)) {
    const types = type.filter((t) => t !== "null");
    return { ...rest, type: types.length === 1 ? types[0] : types };
  }
  if (Array.isArray(anyOf)) {
    const members = (anyOf as JsonSchemaNode[]).filter((m) => m["type"] !== "null");
    if (members.length === 1) {
      return { ...members[0], ...rest };
    }
  }
  return property;
}

/**
 * Advertises nullable top-level properties with their plain type. Tools still accept
 * null, but an anyOf [T, null] schema makes MCP clients guess the type and send
 * structured values as JSON strings (#114).
 */
export function advertisedProperties(properties: Record<string, JsonSchemaNode>): Record<string, JsonSchemaNode> {
  return Object.fromEntries(Object.entries(properties).map(([name, property]) => [name, withoutNull(property)]));
}
