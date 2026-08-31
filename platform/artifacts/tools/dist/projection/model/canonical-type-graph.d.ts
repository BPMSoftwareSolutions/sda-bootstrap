export type CanonicalPrimitiveKind = "string" | "boolean" | "integer" | "number" | "unknown";
export interface CanonicalPrimitiveNode {
    readonly kind: "primitive";
    readonly primitive: CanonicalPrimitiveKind;
    readonly sourcePointer: string;
}
export interface CanonicalEnumNode {
    readonly kind: "enum";
    readonly values: readonly (string | number | boolean)[];
    readonly sourcePointer: string;
}
export interface CanonicalReferenceNode {
    readonly kind: "reference";
    readonly targetPointer: string;
    readonly sourcePointer: string;
}
export interface CanonicalArrayNode {
    readonly kind: "array";
    readonly item: CanonicalTypeNode;
    readonly sourcePointer: string;
}
export interface CanonicalNullableNode {
    readonly kind: "nullable";
    readonly value: CanonicalTypeNode;
    readonly sourcePointer: string;
}
export interface CanonicalReferenceOrStubNode {
    readonly kind: "reference-or-inline-stub";
    readonly targetPointer: string;
    readonly identifierField: string;
    readonly sourcePointer: string;
}
export interface CanonicalProperty {
    readonly name: string;
    readonly value: CanonicalTypeNode;
    readonly required: boolean;
    readonly defaultValue?: string | number | boolean;
    readonly constantValue?: string | number | boolean;
    readonly sourcePointer: string;
}
export interface CanonicalObjectNode {
    readonly kind: "object";
    readonly properties: readonly CanonicalProperty[];
    readonly requiredOrder: readonly string[];
    readonly sourcePointer: string;
}
export type CanonicalTypeNode = CanonicalPrimitiveNode | CanonicalEnumNode | CanonicalReferenceNode | CanonicalArrayNode | CanonicalNullableNode | CanonicalReferenceOrStubNode | CanonicalObjectNode;
export interface CanonicalTypeDefinition {
    readonly sourcePointer: string;
    readonly node: CanonicalTypeNode;
}
export interface CanonicalTypeRoot {
    readonly schemaRef: string;
    readonly sourcePointer: string;
}
export interface CanonicalTypeGraph {
    readonly graphType: "canonical-type-graph.v1";
    readonly roots: readonly CanonicalTypeRoot[];
    readonly definitions: readonly CanonicalTypeDefinition[];
}
