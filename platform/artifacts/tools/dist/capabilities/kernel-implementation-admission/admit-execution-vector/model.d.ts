import type { SourceFact } from "../../../model/semantic-model.js";
import type { SchemaAdmissionResult } from "../../../ports/conformance/schema-admission.js";
export interface ExecutionVectorAdmissionInput {
    readonly executionVectorPath: string;
    readonly executionVector: SourceFact<Record<string, unknown>> | null;
    readonly validation: SourceFact<SchemaAdmissionResult> | null;
}
export interface ExecutionVectorAdmissionEvidence {
    readonly executionVectorPath: string;
    readonly found: boolean;
    readonly valid: boolean;
    readonly errors: readonly string[];
}
export declare const isExecutionVectorAdmissionInput: (value: unknown) => value is ExecutionVectorAdmissionInput;
export declare const isExecutionVectorAdmissionEvidence: (value: unknown) => value is ExecutionVectorAdmissionEvidence;
