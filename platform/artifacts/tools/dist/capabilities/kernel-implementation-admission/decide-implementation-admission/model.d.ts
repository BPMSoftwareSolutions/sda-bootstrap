import type { ConformanceEvidenceSet, ImplementationAdmission } from "../../../conformance/model/conformance-evidence-set.js";
export type ImplementationAdmissionInput = ConformanceEvidenceSet;
export type ImplementationAdmissionEvidence = ImplementationAdmission;
export declare const isImplementationAdmissionInput: (value: unknown) => value is ImplementationAdmissionInput;
export declare const isImplementationAdmissionEvidence: (value: unknown) => value is ImplementationAdmissionEvidence;
