// Target-neutral JSON Schema mechanics shared by canonical IR construction.
// This layer detects meaning but never makes a target rendering decision.
export const PRIMITIVE_DEFS = new Set(["semanticId", "semanticVersion", "digest"]);
export function createSchemaLoader(schemas) {
    return function loadSchema(fileName) {
        const schema = schemas[fileName];
        if (!schema)
            throw new Error(`Unknown schema file: ${fileName}`);
        return schema;
    };
}
/**
 * oneOf[X, {type:"null"}] — X is nullable regardless of whether the
 * property itself is required. Returns the non-null branch, or null if
 * `branches` isn't this pattern.
 */
export function detectNullableOneOf(branches) {
    if (!Array.isArray(branches) || branches.length !== 2)
        return null;
    const nullBranch = branches.find((b) => b && b.type === "null");
    if (!nullBranch)
        return null;
    return branches.find((b) => b !== nullBranch) ?? null;
}
/**
 * oneOf[ $ref to a full object schema, inline object requiring exactly one
 * identifier property ] — a reference-or-inline-stub union, always
 * flattened to one record. Returns { refBranch, idField }, or null if
 * `branches` isn't this pattern.
 */
export function detectReferenceOrInlineStub(branches) {
    if (!Array.isArray(branches) || branches.length !== 2)
        return null;
    const refBranch = branches.find((b) => b && b.$ref);
    const inlineBranch = branches.find((b) => b !== refBranch && b && b.type === "object");
    if (!refBranch || !inlineBranch)
        return null;
    const required = inlineBranch.required;
    const properties = inlineBranch.properties ?? {};
    const propertyNames = Object.keys(properties);
    if (!Array.isArray(required) || required.length !== 1)
        return null;
    if (propertyNames.length !== 1 || propertyNames[0] !== required[0])
        return null;
    return { refBranch, idField: required[0] };
}
/**
 * Splits a schema's properties into three ordered lists — required
 * (non-const), optional (non-const), and const — without deciding how any
 * of them render. Order is preserved: required entries in the schema's own
 * `required` array order, optional entries in `properties` declaration
 * order (excluding whatever is required or const).
 */
export function partitionProperties(schema) {
    const required = schema.required ?? [];
    const requiredSet = new Set(required);
    const properties = schema.properties ?? {};
    const requiredEntries = [];
    const constEntries = [];
    for (const propName of required) {
        const propSchema = properties[propName];
        if (!propSchema)
            continue;
        if (propSchema.const !== undefined) {
            constEntries.push([propName, propSchema.const]);
            continue;
        }
        requiredEntries.push([propName, propSchema]);
    }
    const optionalEntries = [];
    for (const [propName, propSchema] of Object.entries(properties)) {
        if (requiredSet.has(propName))
            continue;
        if (propSchema.const !== undefined) {
            constEntries.push([propName, propSchema.const]);
            continue;
        }
        optionalEntries.push([propName, propSchema]);
    }
    return { requiredEntries, optionalEntries, constEntries };
}
