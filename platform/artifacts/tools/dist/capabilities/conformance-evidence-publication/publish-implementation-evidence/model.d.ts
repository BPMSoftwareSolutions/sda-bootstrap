import type { SourceFact } from "../../../model/semantic-model.js";
import type { ImplementationAdmission } from "../../../conformance/model/conformance-evidence-set.js";
export interface PublishImplementationEvidenceInput {
    readonly admission: ImplementationAdmission;
    readonly generatedAt: SourceFact<string>;
    readonly proofInputDigest: string;
}
export interface PublishedImplementationEvidence extends Omit<ImplementationAdmission, "details"> {
    readonly conformanceType: "scenario-kernel-admission-result.v1";
    readonly generatedAt: string;
    readonly proofInputDigest: string;
    readonly details: Readonly<Record<string, unknown>>;
}
export type PublishImplementationEvidenceEvidence = PublishedImplementationEvidence;
export declare const isPublishImplementationEvidenceInput: (value: unknown) => value is PublishImplementationEvidenceInput;
export declare const isPublishedImplementationEvidence: (value: unknown) => value is PublishedImplementationEvidence;
