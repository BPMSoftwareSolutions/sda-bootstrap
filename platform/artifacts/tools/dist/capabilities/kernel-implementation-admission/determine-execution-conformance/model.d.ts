import type { SourceFact } from "../../../model/semantic-model.js";
import type { SchemaAdmissionResult } from "../../../ports/conformance/schema-admission.js";
export interface ExecutionConformanceInput {
    readonly language: string;
    readonly manifestPath: string;
    readonly manifest: SourceFact<Record<string, unknown>> | null;
    readonly manifestValidation: SourceFact<SchemaAdmissionResult> | null;
    readonly canonicalStepIds: SourceFact<readonly string[]>;
}
export interface ExecutionStepDisposition {
    readonly stepId: string;
    readonly status: "PASS" | "MISSING";
}
export interface ExecutionConformanceEvidence {
    readonly language: string;
    readonly manifestPath: string;
    readonly manifestFound: boolean;
    readonly manifestValid?: boolean;
    readonly steps: readonly ExecutionStepDisposition[];
    readonly conforming: boolean;
}
export declare const isExecutionConformanceInput: (value: unknown) => value is ExecutionConformanceInput;
export declare const isExecutionConformanceEvidence: (value: unknown) => value is ExecutionConformanceEvidence;
