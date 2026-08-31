export type JsonSchema = Record<string, unknown>;
export declare const PRIMITIVE_DEFS: Set<string>;
export interface SchemaLoader {
    (fileName: string): JsonSchema;
}
export declare function createSchemaLoader(schemas: Readonly<Record<string, JsonSchema>>): SchemaLoader;
/**
 * oneOf[X, {type:"null"}] — X is nullable regardless of whether the
 * property itself is required. Returns the non-null branch, or null if
 * `branches` isn't this pattern.
 */
export declare function detectNullableOneOf(branches: unknown): JsonSchema | null;
export interface ReferenceOrInlineStub {
    readonly refBranch: JsonSchema;
    readonly idField: string;
}
/**
 * oneOf[ $ref to a full object schema, inline object requiring exactly one
 * identifier property ] — a reference-or-inline-stub union, always
 * flattened to one record. Returns { refBranch, idField }, or null if
 * `branches` isn't this pattern.
 */
export declare function detectReferenceOrInlineStub(branches: unknown): ReferenceOrInlineStub | null;
export interface PropertyPartition {
    readonly requiredEntries: readonly (readonly [string, JsonSchema])[];
    readonly optionalEntries: readonly (readonly [string, JsonSchema])[];
    readonly constEntries: readonly (readonly [string, unknown])[];
}
/**
 * Splits a schema's properties into three ordered lists — required
 * (non-const), optional (non-const), and const — without deciding how any
 * of them render. Order is preserved: required entries in the schema's own
 * `required` array order, optional entries in `properties` declaration
 * order (excluding whatever is required or const).
 */
export declare function partitionProperties(schema: JsonSchema): PropertyPartition;
