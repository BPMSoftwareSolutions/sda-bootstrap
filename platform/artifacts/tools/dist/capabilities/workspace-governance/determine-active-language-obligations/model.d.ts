import type { BindingFileFact } from "../discover-language-bindings/model.js";
export interface LanguageObligationInput {
    readonly bindingFiles: readonly BindingFileFact[];
}
export interface LanguageObligation {
    readonly language: string;
    readonly bindingPath: string;
    readonly binding: Record<string, unknown>;
    readonly status: string;
    readonly isActiveObligation: boolean;
}
export interface LanguageObligationEvidence {
    readonly obligations: readonly LanguageObligation[];
}
export declare function isLanguageObligationInput(value: unknown): value is LanguageObligationInput;
export declare function isLanguageObligationEvidence(value: unknown): value is LanguageObligationEvidence;
