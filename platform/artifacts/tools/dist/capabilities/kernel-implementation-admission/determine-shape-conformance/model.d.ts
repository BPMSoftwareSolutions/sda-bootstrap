import type { SourceFact } from "../../../model/semantic-model.js";
import type { SchemaAdmissionResult } from "../../../ports/conformance/schema-admission.js";
export interface ShapeConformanceInput {
    readonly language: string;
    readonly manifestPath: string;
    readonly manifest: SourceFact<Record<string, unknown>> | null;
    readonly manifestValidation: SourceFact<SchemaAdmissionResult> | null;
    readonly canonicalObjectIds: SourceFact<readonly string[]>;
}
export interface ShapeDisposition {
    readonly objectId: string;
    readonly status: "PASS" | "MISSING";
}
export interface ShapeConformanceEvidence {
    readonly language: string;
    readonly manifestPath: string;
    readonly manifestFound: boolean;
    readonly manifestValid: boolean;
    readonly errors?: readonly string[];
    readonly objects: readonly ShapeDisposition[];
    readonly conforming: boolean;
}
export declare const isShapeConformanceInput: (value: unknown) => value is ShapeConformanceInput;
export declare const isShapeConformanceEvidence: (value: unknown) => value is ShapeConformanceEvidence;
