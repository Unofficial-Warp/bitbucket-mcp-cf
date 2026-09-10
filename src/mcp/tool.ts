import { Effect, Schema } from "effect"
import type { JsonSchema } from "effect"

export class InvalidToolInput extends Schema.TaggedErrorClass<InvalidToolInput>()(
  "InvalidToolInput",
  { message: Schema.String }
) {}

export interface McpTool<R> {
  readonly name: string
  readonly description: string
  readonly write: boolean
  readonly inputSchema: JsonSchema.JsonSchema
  readonly run: (args: unknown) => Effect.Effect<string, unknown, R>
}

const ANNOTATION_KEYWORDS = ["description", "title", "default", "examples"]

// Effect emits checked types (e.g. `Schema.Int`) as `{type, allOf: [{description}]}`.
// Hoisting the annotations keeps tool arguments readable for MCP clients.
const hoistAnnotations = (schema: unknown): JsonSchema.JsonSchema => {
  const property = schema as Record<string, unknown>
  const allOf = property.allOf
  if (!Array.isArray(allOf)) {
    return property as JsonSchema.JsonSchema
  }
  const annotationOnly = allOf.filter((entry) =>
    entry !== null && typeof entry === "object" &&
    Object.keys(entry).every((key) => ANNOTATION_KEYWORDS.includes(key))
  )
  if (annotationOnly.length !== allOf.length) {
    return property as JsonSchema.JsonSchema
  }
  const { allOf: _, ...rest } = property
  return Object.assign(rest, ...annotationOnly) as JsonSchema.JsonSchema
}

const toJsonSchema = (schema: Schema.Top): JsonSchema.JsonSchema => {
  const document = Schema.toJsonSchemaDocument(schema)
  const jsonSchema = document.schema

  // A parameterless tool encodes as `anyOf: [object, array]`, which MCP rejects.
  if (jsonSchema.type !== "object") {
    return { type: "object", properties: {}, additionalProperties: false }
  }

  const properties = jsonSchema.properties
  if (properties) {
    jsonSchema.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, hoistAnnotations(value)])
    )
  }
  if (Object.keys(document.definitions).length > 0) {
    jsonSchema.$defs = document.definitions
  }
  return jsonSchema
}

export const make = <Params extends Schema.Codec<any, any, never, never>, E, R>(def: {
  readonly name: string
  readonly description: string
  readonly write?: boolean | undefined
  readonly parameters: Params
  readonly handler: (params: Params["Type"]) => Effect.Effect<unknown, E, R>
}): McpTool<R> => {
  const decode = Schema.decodeUnknownEffect(def.parameters)
  return {
    name: def.name,
    description: def.description,
    write: def.write ?? false,
    inputSchema: toJsonSchema(def.parameters),
    run: (args) =>
      decode(args ?? {}).pipe(
        Effect.mapError((error) =>
          new InvalidToolInput({ message: `invalid arguments for ${def.name}: ${error.message}` })
        ),
        Effect.flatMap(def.handler),
        Effect.map((result) => typeof result === "string" ? result : JSON.stringify(result))
      )
  }
}
