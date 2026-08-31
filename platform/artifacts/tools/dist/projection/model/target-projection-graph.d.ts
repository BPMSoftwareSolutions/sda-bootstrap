import type { ProjectionTarget } from "./projection-profile.js";
export interface TargetFieldDefinition {
    readonly name: string;
    readonly type: string;
    readonly optional: boolean;
    readonly defaultLiteral?: string;
    readonly dependencies: readonly string[];
    readonly sourcePointer: string;
}
export interface TargetConstantDefinition {
    readonly name: string;
    readonly value: string | number | boolean;
    readonly sourcePointer: string;
}
export interface TargetObjectDefinition {
    readonly kind: "object";
    readonly typeName: string;
    readonly sourcePointer: string;
    readonly fields: readonly TargetFieldDefinition[];
    readonly constants: readonly TargetConstantDefinition[];
}
export interface TargetEnumDefinition {
    readonly kind: "enum";
    readonly typeName: string;
    readonly sourcePointer: string;
    readonly values: readonly (string | number | boolean)[];
}
export type TargetTypeDefinition = TargetObjectDefinition | TargetEnumDefinition;
export interface TargetProjectionGraph {
    readonly graphType: "target-projection-graph.v1";
    readonly target: ProjectionTarget;
    readonly definitions: readonly TargetTypeDefinition[];
    readonly emissionOrder: readonly string[];
}
