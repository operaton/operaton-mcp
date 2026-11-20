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

// Converts OpenAPI 3 JSON Schemas into Zod source code. $refs are inlined so the
// resulting tool input schemas are self-contained (no $ref/$defs for MCP clients).

export interface JsonSchema {
  type?: string;
  format?: string;
  nullable?: boolean;
  enum?: unknown[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  allOf?: JsonSchema[];
  $ref?: string;
  description?: string;
}

/** Objects and arrays nested deeper than this are emitted as z.unknown(). */
export const MAX_DEPTH = 4;

const REF_PREFIX = "#/components/schemas/";

export interface ShapeProperty {
  schema: JsonSchema;
  /** $ref names already expanded on the path to this property (cycle guard). */
  seen: Set<string>;
}

export interface ObjectShape {
  properties: Record<string, ShapeProperty>;
  required: string[];
  additionalProperties?: boolean | JsonSchema;
  seen: Set<string>;
}

function refName(ref: string): string {
  return ref.startsWith(REF_PREFIX) ? ref.slice(REF_PREFIX.length) : ref;
}

function isObjectSchema(schema: JsonSchema): boolean {
  return schema.type === "object" || schema.properties !== undefined || schema.allOf !== undefined;
}

/**
 * Resolves an object schema (following $ref and merging allOf members) into a flat
 * property map. Returns null if the schema is not an object or a $ref cycle is hit.
 */
export function resolveObjectShape(
  schema: JsonSchema,
  components: Record<string, JsonSchema>,
  seen: Set<string> = new Set(),
): ObjectShape | null {
  if (schema.$ref) {
    const name = refName(schema.$ref);
    const target = components[name];
    if (!target || seen.has(name)) return null;
    return resolveObjectShape(target, components, new Set(seen).add(name));
  }
  if (!isObjectSchema(schema)) return null;

  const shape: ObjectShape = { properties: {}, required: [], seen };
  for (const member of schema.allOf ?? []) {
    const memberShape = resolveObjectShape(member, components, seen);
    if (!memberShape) return null;
    Object.assign(shape.properties, memberShape.properties);
    shape.required.push(...memberShape.required);
    shape.additionalProperties ??= memberShape.additionalProperties;
  }
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    shape.properties[name] = { schema: property, seen };
  }
  shape.required.push(...(schema.required ?? []));
  if (schema.additionalProperties !== undefined) {
    shape.additionalProperties = schema.additionalProperties;
  }
  return shape;
}

function objectShapeToZod(shape: ObjectShape, components: Record<string, JsonSchema>, depth: number): string {
  const entries = Object.entries(shape.properties);
  if (entries.length === 0) {
    const values =
      typeof shape.additionalProperties === "object"
        ? jsonSchemaToZod(shape.additionalProperties, components, depth + 1, shape.seen)
        : "z.unknown()";
    return `z.record(z.string(), ${values})`;
  }
  const fields = entries.map(([name, property]) => {
    const optional = shape.required.includes(name) ? "" : ".optional()";
    return `${JSON.stringify(name)}: ${jsonSchemaToZod(property.schema, components, depth + 1, property.seen)}${optional}`;
  });
  return `z.object({ ${fields.join(", ")} }).passthrough()`;
}

export function jsonSchemaToZod(
  schema: JsonSchema,
  components: Record<string, JsonSchema>,
  depth = 0,
  seen: Set<string> = new Set(),
): string {
  if (schema.$ref) {
    const name = refName(schema.$ref);
    const target = components[name];
    if (!target || seen.has(name)) return "z.unknown()";
    return jsonSchemaToZod(target, components, depth, new Set(seen).add(name));
  }

  let code: string;
  if (isObjectSchema(schema)) {
    const shape = depth > MAX_DEPTH ? null : resolveObjectShape(schema, components, seen);
    code = shape ? objectShapeToZod(shape, components, depth) : "z.unknown()";
  } else {
    switch (schema.type) {
      case "string": {
        const values = (schema.enum ?? []).filter((v): v is string => typeof v === "string");
        code = values.length > 0 ? `z.enum(${JSON.stringify(values)})` : "z.string()";
        break;
      }
      case "integer":
        code = "z.number().int()";
        break;
      case "number":
        code = "z.number()";
        break;
      case "boolean":
        code = "z.boolean()";
        break;
      case "array":
        code =
          depth > MAX_DEPTH
            ? "z.unknown()"
            : `z.array(${schema.items ? jsonSchemaToZod(schema.items, components, depth + 1, seen) : "z.unknown()"})`;
        break;
      default:
        code = "z.unknown()";
    }
  }

  return schema.nullable && code !== "z.unknown()" ? `${code}.nullable()` : code;
}
