function pascalCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
function snakeCase(value) {
    return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}
function screamingSnakeCase(value) {
    return snakeCase(value).replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
}
function literal(target, profile, value) {
    if (typeof value === "string")
        return JSON.stringify(value);
    if (typeof value === "boolean") {
        if (profile.nativeTypePolicy)
            return value ? profile.nativeTypePolicy.trueLiteral : profile.nativeTypePolicy.falseLiteral;
        if (target === "python")
            return value ? "True" : "False";
        return value ? "true" : "false";
    }
    return String(value);
}
function primitiveType(target, primitive, profile) {
    if (primitive.primitive === "unknown")
        return profile.openPayloadType;
    if (profile.nativeTypePolicy)
        return profile.nativeTypePolicy.primitiveTypes[primitive.primitive];
    if (target === "csharp") {
        return { string: "string", boolean: "bool", integer: "long", number: "double" }[primitive.primitive];
    }
    if (target === "node") {
        return { string: "string", boolean: "boolean", integer: "number", number: "number" }[primitive.primitive];
    }
    if (target === "python") {
        return { string: "str", boolean: "bool", integer: "int", number: "float" }[primitive.primitive];
    }
    if (target === "java") {
        return { string: "String", boolean: "boolean", integer: "long", number: "double" }[primitive.primitive];
    }
    return { string: "string", boolean: "bool", integer: "int64", number: "float64" }[primitive.primitive];
}
function arrayType(target, profile, itemType) {
    if (profile.nativeTypePolicy)
        return profile.nativeTypePolicy.arrayTypePattern.replace("{item}", itemType);
    if (target === "csharp")
        return `IReadOnlyList<${itemType}>`;
    if (target === "node")
        return `${itemType}[]`;
    if (target === "python")
        return `tuple[${itemType}, ...]`;
    if (target === "java")
        return `List<${itemType}>`;
    return `[]${itemType}`;
}
function nullableType(target, profile, valueType) {
    if (profile.nativeTypePolicy) {
        const prefix = profile.nativeTypePolicy.nullableTypePattern.split("{value}")[0] ?? "";
        return prefix && valueType.startsWith(prefix)
            ? valueType
            : profile.nativeTypePolicy.nullableTypePattern.replace("{value}", valueType);
    }
    if (target === "csharp")
        return valueType.endsWith("?") ? valueType : `${valueType}?`;
    if (target === "node")
        return valueType.includes("| null") ? valueType : `${valueType} | null`;
    if (target === "python")
        return valueType.endsWith(" | None") ? valueType : `${valueType} | None`;
    if (target === "go")
        return valueType;
    return valueType;
}
function memberName(target, profile, value) {
    const converted = profile.nativeTypePolicy
        ? profile.memberNaming === "pascal-case"
            ? pascalCase(value)
            : profile.memberNaming === "snake_case"
                ? snakeCase(value)
                : value
        : target === "csharp"
            ? pascalCase(value)
            : target === "python"
                ? snakeCase(value)
                : value;
    return profile.reservedWords?.includes(converted) ? `${converted}${profile.reservedWordSuffix ?? "_"}` : converted;
}
function nestedTypeName(parentTypeName, pointer) {
    const segments = pointer.split("/");
    const tail = segments.at(-1) ?? "value";
    return `${parentTypeName}${pascalCase(tail)}`;
}
export class TargetProjectionGraphBuilder {
    canonical;
    profile;
    definitionsByPointer = new Map();
    rootTypeNames = new Map();
    targetDefinitions = new Map();
    emissionOrder = [];
    constructor(canonical, profile) {
        this.canonical = canonical;
        this.profile = profile;
        for (const definition of canonical.definitions)
            this.definitionsByPointer.set(definition.sourcePointer, definition.node);
        for (const object of profile.objects) {
            const root = canonical.roots.find((candidate) => candidate.schemaRef === object.schemaRef);
            if (!root)
                throw new Error(`Projection profile references '${object.schemaRef}', which is absent from canonical authority.`);
            this.rootTypeNames.set(root.sourcePointer, object.typeName);
        }
    }
    build() {
        for (const root of this.canonical.roots) {
            const typeName = this.rootTypeNames.get(root.sourcePointer);
            if (!typeName)
                throw new Error(`No target type decision exists for '${root.sourcePointer}'.`);
            const node = this.definition(root.sourcePointer);
            if (node.kind !== "object") {
                throw new Error(`Root '${root.sourcePointer}' must resolve to an object schema.`);
            }
            this.deriveObject(typeName, node);
        }
        return {
            graphType: "target-projection-graph.v1",
            target: this.profile.language,
            definitions: this.emissionOrder.map((name) => {
                const definition = this.targetDefinitions.get(name);
                if (!definition)
                    throw new Error(`Emission order references unknown target type '${name}'.`);
                return definition;
            }),
            emissionOrder: this.emissionOrder
        };
    }
    definition(pointer) {
        const node = this.definitionsByPointer.get(pointer);
        if (!node)
            throw new Error(`Canonical reference '${pointer}' was not resolved before target projection.`);
        return node;
    }
    register(definition) {
        if (this.targetDefinitions.has(definition.typeName))
            return;
        this.targetDefinitions.set(definition.typeName, definition);
        this.emissionOrder.push(definition.typeName);
    }
    mapNode(node, parentTypeName) {
        const target = this.profile.language;
        if (node.kind === "primitive")
            return { type: primitiveType(target, node, this.profile), dependencies: [] };
        if (node.kind === "array") {
            const item = this.mapNode(node.item, parentTypeName);
            return { type: arrayType(target, this.profile, item.type), dependencies: item.dependencies };
        }
        if (node.kind === "nullable") {
            const mapped = this.mapNode(node.value, parentTypeName);
            return { type: nullableType(target, this.profile, mapped.type), dependencies: mapped.dependencies };
        }
        if (node.kind === "reference")
            return this.mapReference(node.targetPointer, node.sourcePointer, parentTypeName);
        if (node.kind === "reference-or-inline-stub") {
            return this.mapReferenceOrStub(node.targetPointer, node.identifierField, node.sourcePointer, parentTypeName);
        }
        if (node.kind === "enum") {
            const override = this.profile.enumTypeOverrides?.[node.sourcePointer];
            if (!override)
                return { type: primitiveType(target, { kind: "primitive", primitive: "string", sourcePointer: node.sourcePointer }, this.profile), dependencies: [] };
            this.register({ kind: "enum", typeName: override, sourcePointer: node.sourcePointer, values: node.values });
            return { type: override, dependencies: [override] };
        }
        const typeName = this.profile.nestedTypeOverrides?.[node.sourcePointer] ?? nestedTypeName(parentTypeName, node.sourcePointer);
        this.deriveObject(typeName, node);
        return { type: typeName, dependencies: [typeName] };
    }
    mapReference(targetPointer, sourcePointer, parentTypeName) {
        const rootTypeName = this.rootTypeNames.get(targetPointer);
        if (rootTypeName)
            return { type: rootTypeName, dependencies: [rootTypeName] };
        const node = this.definition(targetPointer);
        if (node.kind === "primitive" || node.kind === "enum" || node.kind === "array" || node.kind === "nullable") {
            return this.mapNode(node, parentTypeName);
        }
        if (node.kind !== "object")
            throw new Error(`Reference '${targetPointer}' does not resolve to a projectable type.`);
        const override = this.profile.nestedTypeOverrides?.[targetPointer] ?? this.profile.nestedTypeOverrides?.[sourcePointer];
        const defName = targetPointer.split("/").at(-1) ?? "value";
        const typeName = override ?? `${parentTypeName}${pascalCase(defName)}`;
        this.deriveObject(typeName, node);
        return { type: typeName, dependencies: [typeName] };
    }
    mapReferenceOrStub(targetPointer, identifierField, sourcePointer, parentTypeName) {
        const referenced = this.mapReference(targetPointer, sourcePointer, parentTypeName);
        const typeName = this.profile.nestedTypeOverrides?.[sourcePointer] ?? `${parentTypeName}${referenced.type}`;
        if (!this.targetDefinitions.has(typeName)) {
            const target = this.profile.language;
            const referenceNaming = this.profile.nativeTypePolicy?.referenceMemberNaming;
            const referencedName = referenceNaming === "pascal-case" || target === "csharp"
                ? referenced.type
                : referenceNaming === "snake_case" || target === "python"
                    ? snakeCase(referenced.type)
                    : referenceNaming === "preserve"
                        ? referenced.type
                        : referenced.type.charAt(0).toLowerCase() + referenced.type.slice(1);
            const optionalReferenced = this.profile.nativeTypePolicy || target === "csharp" || target === "python"
                ? nullableType(target, this.profile, referenced.type)
                : referenced.type;
            const identifier = {
                name: memberName(target, this.profile, identifierField),
                type: primitiveType(target, { kind: "primitive", primitive: "string", sourcePointer }, this.profile),
                optional: false,
                dependencies: [],
                sourcePointer
            };
            const referencedBase = {
                name: memberName(target, this.profile, referencedName),
                type: optionalReferenced,
                optional: true,
                dependencies: referenced.dependencies,
                sourcePointer
            };
            const defaultLiteral = this.profile.nativeTypePolicy?.nullLiteral ?? (target === "csharp" ? "null" : target === "python" ? "None" : undefined);
            const referencedField = defaultLiteral === undefined
                ? referencedBase
                : { ...referencedBase, defaultLiteral };
            const fields = [identifier, referencedField];
            this.register({ kind: "object", typeName, sourcePointer, fields, constants: [] });
        }
        return { type: typeName, dependencies: [typeName] };
    }
    deriveObject(typeName, node) {
        if (this.targetDefinitions.has(typeName))
            return;
        const constants = [];
        const fields = [];
        for (const property of node.properties) {
            if (property.constantValue !== undefined) {
                constants.push({
                    name: this.profile.language === "csharp" ? pascalCase(property.name) : screamingSnakeCase(property.name),
                    value: property.constantValue,
                    sourcePointer: property.sourcePointer
                });
                continue;
            }
            fields.push(this.mapField(property, typeName));
        }
        this.register({ kind: "object", typeName, sourcePointer: node.sourcePointer, fields, constants });
    }
    mapField(property, parentTypeName) {
        const target = this.profile.language;
        const mapped = this.mapNode(property.value, parentTypeName);
        const name = memberName(target, this.profile, property.name);
        if (property.required) {
            return {
                name,
                type: mapped.type,
                optional: false,
                dependencies: mapped.dependencies,
                sourcePointer: property.sourcePointer
            };
        }
        if (this.profile.nativeTypePolicy) {
            if (this.profile.defaultStrategy === "materialize-in-model" && property.defaultValue !== undefined) {
                return {
                    name,
                    type: mapped.type,
                    optional: true,
                    defaultLiteral: literal(target, this.profile, property.defaultValue),
                    dependencies: mapped.dependencies,
                    sourcePointer: property.sourcePointer
                };
            }
            return {
                name,
                type: nullableType(target, this.profile, mapped.type),
                optional: true,
                defaultLiteral: this.profile.nativeTypePolicy.nullLiteral,
                dependencies: mapped.dependencies,
                sourcePointer: property.sourcePointer
            };
        }
        if (target === "csharp") {
            if (this.profile.defaultStrategy === "materialize-in-model" && property.defaultValue !== undefined) {
                return {
                    name,
                    type: mapped.type,
                    optional: true,
                    defaultLiteral: literal(target, this.profile, property.defaultValue),
                    dependencies: mapped.dependencies,
                    sourcePointer: property.sourcePointer
                };
            }
            return {
                name,
                type: nullableType(target, this.profile, mapped.type),
                optional: true,
                defaultLiteral: "null",
                dependencies: mapped.dependencies,
                sourcePointer: property.sourcePointer
            };
        }
        if (target === "python") {
            return {
                name,
                type: nullableType(target, this.profile, mapped.type),
                optional: true,
                defaultLiteral: "None",
                dependencies: mapped.dependencies,
                sourcePointer: property.sourcePointer
            };
        }
        if (target === "java") {
            const boxed = { boolean: "Boolean", long: "Long", double: "Double" }[mapped.type] ?? mapped.type;
            return { name, type: boxed, optional: true, dependencies: mapped.dependencies, sourcePointer: property.sourcePointer };
        }
        if (target === "go") {
            const optionalType = ["bool", "int64", "float64"].includes(mapped.type) ? `*${mapped.type}` : mapped.type;
            return { name, type: optionalType, optional: true, dependencies: mapped.dependencies, sourcePointer: property.sourcePointer };
        }
        return { name, type: mapped.type, optional: true, dependencies: mapped.dependencies, sourcePointer: property.sourcePointer };
    }
}
