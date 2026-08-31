import type { SourceFact } from "../../../model/semantic-model.js";
import type { SchemaAdmissionResult } from "../../../ports/conformance/schema-admission.js";
export interface GovernedDocumentFact {
    readonly fact: SourceFact<Record<string, unknown>>;
    readonly validation?: SourceFact<SchemaAdmissionResult>;
}
export interface GovernedPlacementInput {
    readonly corpusExecutionDirectory: string;
    readonly expectationsExecutionDirectory: string;
    readonly fixtures: readonly GovernedDocumentFact[];
    readonly expectations: readonly GovernedDocumentFact[];
    readonly languageConformanceClaims: readonly GovernedDocumentFact[];
    readonly sharedConformanceDocuments: readonly GovernedDocumentFact[];
}
export interface GovernedPlacementViolation {
    readonly rule: "K006A" | "K006B" | "K006C" | "K006D" | "K006E";
    readonly file: string;
    readonly reason: string;
}
export interface GovernedPlacementEvidence {
    readonly violations: readonly GovernedPlacementViolation[];
    readonly conforming: boolean;
}
export declare function isGovernedPlacementInput(value: unknown): value is GovernedPlacementInput;
export declare function isGovernedPlacementEvidence(value: unknown): value is GovernedPlacementEvidence;
