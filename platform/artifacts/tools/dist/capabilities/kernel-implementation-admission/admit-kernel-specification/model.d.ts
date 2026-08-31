import type { SourceFact } from "../../../model/semantic-model.js";
import type { SchemaAdmissionResult } from "../../../ports/conformance/schema-admission.js";
export interface KernelSpecificationAdmissionInput {
    readonly specificationPath: string;
    readonly specification: SourceFact<Record<string, unknown>> | null;
    readonly validation: SourceFact<SchemaAdmissionResult> | null;
}
export interface KernelSpecificationAdmissionEvidence {
    readonly specificationPath: string;
    readonly found: boolean;
    readonly valid: boolean;
    readonly errors: readonly string[];
}
export declare const isKernelSpecificationAdmissionInput: (value: unknown) => value is KernelSpecificationAdmissionInput;
export declare const isKernelSpecificationAdmissionEvidence: (value: unknown) => value is KernelSpecificationAdmissionEvidence;
