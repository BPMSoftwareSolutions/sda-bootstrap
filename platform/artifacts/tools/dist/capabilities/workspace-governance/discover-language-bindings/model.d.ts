import type { SourceFact } from "../../../model/semantic-model.js";
export interface BindingFileFact {
    readonly language: string;
    readonly fact: SourceFact<Record<string, unknown>>;
}
export interface LanguageBindingDiscoveryInput {
    readonly languagesDirectory: string;
    readonly languageDirectories: SourceFact<readonly string[]>;
    readonly bindingFiles: readonly BindingFileFact[];
}
export interface DiscoveredLanguageBinding {
    readonly language: string;
    readonly bindingPath: string;
    readonly binding: Record<string, unknown>;
}
export interface LanguageBindingDiscoveryEvidence {
    readonly languagesDirectory: string;
    readonly expectedBindingFileCount: number;
    readonly discovered: readonly DiscoveredLanguageBinding[];
    readonly duplicateBindingPaths: readonly string[];
}
export declare function isLanguageBindingDiscoveryInput(value: unknown): value is LanguageBindingDiscoveryInput;
export declare function isLanguageBindingDiscoveryEvidence(value: unknown): value is LanguageBindingDiscoveryEvidence;
