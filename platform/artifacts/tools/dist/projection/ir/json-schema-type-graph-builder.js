import { detectNullableOneOf, detectReferenceOrInlineStub } from "./schema-mechanics.js";
function splitSchemaPointer(value) {
    const separator = value.indexOf("#");
    return separator < 0
        ? { file: value, fragment: "" }
        : { file: value.slice(0, separator), fragment: value.slice(separator + 1) };
}
function canonicalPointer(file, fragment) {
    return `${file}#${fragment}`;
}
function resolveReference(currentFile, reference) {
    if (reference.startsWith("#"))
        return canonicalPointer(currentFile, reference.slice(1));
    const { file, fragment } = splitSchemaPointer(reference);
    return canonicalPointer(file, fragment);
}
function schemaAt(schema, fragment, sourcePointer) {
    if (!fragment)
        return schema;
    const segments = fragment.split("/").filter(Boolean).map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
    let value = schema;
    for (const segment of segments) {
        if (!value || typeof value !== "object" || Array.isArray(value) || !(segment in value)) {
            throw new Error(`Unresolved schema pointer '${sourcePointer}'.`);
        }
        value = value[segment];
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`Schema pointer '${sourcePointer}' does not resolve to an object schema.`);
    }
    return value;
}
function admittedLiteral(value, sourcePointer) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return value;
    throw new Error(`Unsupported literal at '${sourcePointer}': ${JSON.stringify(value)}.`);
}
export class JsonSchemaTypeGraphBuilder {
    loadSchema;
    definitions = new Map();
    resolving = new Set();
    constructor(loadSchema) {
        this.loadSchema = loadSchema;
    }
    build(schemaRefs) {
        const roots = [];
        const seenRoots = new Set();
        for (const schemaRef of schemaRefs) {
            const { file, fragment } = splitSchemaPointer(schemaRef);
            const sourcePointer = canonicalPointer(file, fragment);
            if (seenRoots.has(sourcePointer))
                continue;
            seenRoots.add(sourcePointer);
            this.buildDefinition(sourcePointer);
            roots.push({ schemaRef, sourcePointer });
        }
        return {
            graphType: "canonical-type-graph.v1",
            roots,
            definitions: [...this.definitions.values()]
        };
    }
    buildDefinition(sourcePointer) {
        const existing = this.definitions.get(sourcePointer);
        if (existing)
            return existing;
        if (this.resolving.has(sourcePointer)) {
            throw new Error(`Cyclic schema reference '${sourcePointer}' is not supported by the admitted projection profile.`);
        }
        this.resolving.add(sourcePointer);
        const { file, fragment } = splitSchemaPointer(sourcePointer);
        const schema = schemaAt(this.loadSchema(file), fragment, sourcePointer);
        const definition = { sourcePointer, node: this.buildNode(schema, file, sourcePointer) };
        this.definitions.set(sourcePointer, definition);
        this.resolving.delete(sourcePointer);
        return definition;
    }
    buildNode(schema, currentFile, sourcePointer) {
        const reference = schema["$ref"];
        if (typeof reference === "string") {
            const targetPointer = resolveReference(currentFile, reference);
            this.buildDefinition(targetPointer);
            return { kind: "reference", targetPointer, sourcePointer };
        }
        const branches = schema["oneOf"];
        if (branches !== undefined) {
            const nullable = detectNullableOneOf(branches);
            if (nullable) {
                return {
                    kind: "nullable",
                    value: this.buildNode(nullable, currentFile, sourcePointer),
                    sourcePointer
                };
            }
            const stub = detectReferenceOrInlineStub(branches);
            if (stub) {
                const stubReference = stub.refBranch["$ref"];
                if (typeof stubReference !== "string")
                    throw new Error(`Invalid reference branch at '${sourcePointer}'.`);
                const targetPointer = resolveReference(currentFile, stubReference);
                this.buildDefinition(targetPointer);
                return {
                    kind: "reference-or-inline-stub",
                    targetPointer,
                    identifierField: stub.idField,
                    sourcePointer
                };
            }
            throw new Error(`Unsupported oneOf shape at '${sourcePointer}'.`);
        }
        const type = schema["type"];
        if (type === "object")
            return this.buildObject(schema, currentFile, sourcePointer);
        if (type === "array") {
            const itemSchema = schema["items"];
            if (!itemSchema || typeof itemSchema !== "object" || Array.isArray(itemSchema)) {
                throw new Error(`Array schema at '${sourcePointer}' has no admitted item schema.`);
            }
            return {
                kind: "array",
                item: this.buildNode(itemSchema, currentFile, `${sourcePointer}/items`),
                sourcePointer
            };
        }
        if (type === "string" && Array.isArray(schema["enum"])) {
            return {
                kind: "enum",
                values: schema["enum"].map((value) => admittedLiteral(value, sourcePointer)),
                sourcePointer
            };
        }
        if (type === "string" || type === "boolean" || type === "integer" || type === "number") {
            return { kind: "primitive", primitive: type, sourcePointer };
        }
        if (type === undefined && schema["const"] === undefined) {
            return { kind: "primitive", primitive: "unknown", sourcePointer };
        }
        throw new Error(`Unsupported schema mechanics at '${sourcePointer}': ${JSON.stringify(schema)}.`);
    }
    buildObject(schema, currentFile, sourcePointer) {
        const requiredOrder = Array.isArray(schema["required"])
            ? schema["required"].map((name) => String(name))
            : [];
        const required = new Set(requiredOrder);
        const encodedProperties = schema["properties"];
        const propertiesByName = encodedProperties && typeof encodedProperties === "object" && !Array.isArray(encodedProperties)
            ? encodedProperties
            : {};
        const orderedNames = [
            ...requiredOrder.filter((name) => name in propertiesByName),
            ...Object.keys(propertiesByName).filter((name) => !required.has(name))
        ];
        const properties = orderedNames.map((name) => {
            const propertySchema = propertiesByName[name];
            if (!propertySchema)
                throw new Error(`Property '${name}' disappeared at '${sourcePointer}'.`);
            const propertyPointer = `${sourcePointer}/properties/${name}`;
            const base = {
                name,
                value: propertySchema["const"] === undefined
                    ? this.buildNode(propertySchema, currentFile, propertyPointer)
                    : { kind: "primitive", primitive: "unknown", sourcePointer: propertyPointer },
                required: required.has(name),
                sourcePointer: propertyPointer
            };
            const defaultValue = propertySchema["default"];
            const constantValue = propertySchema["const"];
            return {
                ...base,
                ...(defaultValue === undefined ? {} : { defaultValue: admittedLiteral(defaultValue, propertyPointer) }),
                ...(constantValue === undefined ? {} : { constantValue: admittedLiteral(constantValue, propertyPointer) })
            };
        });
        return { kind: "object", properties, requiredOrder, sourcePointer };
    }
}
