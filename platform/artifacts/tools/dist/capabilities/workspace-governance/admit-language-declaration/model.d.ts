import type { SourceFact } from "../../../model/semantic-model.js";
import type { SchemaAdmissionResult } from "../../../ports/conformance/schema-admission.js";
export interface LanguageDeclarationInput {
    readonly language: string;
    readonly binding: SourceFact<Record<string, unknown>>;
    readonly bindingValidation: SourceFact<SchemaAdmissionResult>;
    readonly manifestPath: string;
    readonly manifest: SourceFact<Record<string, unknown>> | null;
    readonly manifestValidation: SourceFact<SchemaAdmissionResult> | null;
}
export interface LanguageDeclarationEvidence {
    readonly bindingValid: boolean;
    readonly bindingErrors: readonly string[];
    readonly manifestPath: string;
    readonly conformanceClaimValid: boolean;
    readonly conformanceClaimErrors: readonly string[];
}
export declare function isLanguageDeclarationInput(value: unknown): value is LanguageDeclarationInput;
export declare function isLanguageDeclarationEvidence(value: unknown): value is LanguageDeclarationEvidence;
