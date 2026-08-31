/** Open identity admitted by language-target-registration.v1. */
export type ProjectionTarget = string;
export interface NativeTypePolicy {
    readonly primitiveTypes: Readonly<Record<"string" | "boolean" | "integer" | "number", string>>;
    readonly arrayTypePattern: string;
    readonly nullableTypePattern: string;
    readonly referenceMemberNaming: "pascal-case" | "camel-case" | "snake_case" | "preserve";
    readonly nullLiteral: string;
    readonly trueLiteral: string;
    readonly falseLiteral: string;
}
export interface ProjectionProfileObject {
    readonly schemaRef: string;
    readonly typeName: string;
}
export interface StructuralProjectionProfile {
    readonly projectionType: "scenario-kernel-language-projection.v1";
    readonly language: ProjectionTarget;
    readonly implementationId: string;
    readonly outputDirectory: string;
    readonly openPayloadType: string;
    readonly typeStrategy: string;
    readonly memberNaming: "pascal-case" | "preserve" | "snake_case";
    readonly arrayStrategy: string;
    readonly defaultStrategy: "materialize-in-model" | "preserve-optional";
    readonly namespace?: string;
    readonly reservedWordSuffix?: string;
    readonly reservedWords?: readonly string[];
    readonly nestedTypeOverrides?: Readonly<Record<string, string>>;
    readonly enumTypeOverrides?: Readonly<Record<string, string>>;
    readonly nativeTypePolicy?: NativeTypePolicy;
    readonly executionMechanics?: Readonly<Record<string, unknown>>;
    readonly objects: readonly ProjectionProfileObject[];
}
