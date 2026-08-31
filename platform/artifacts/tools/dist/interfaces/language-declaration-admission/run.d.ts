import { type LanguageDeclarationEvidence } from "../../capabilities/workspace-governance/admit-language-declaration/model.js";
import type { ScenarioClosure } from "../../model/semantic-model.js";
export interface LanguageDeclarationAdmissionRun {
    readonly closure: ScenarioClosure<LanguageDeclarationEvidence>;
    readonly observations: readonly unknown[];
}
export declare function runLanguageDeclarationAdmission(options: {
    readonly repositoryRoot: string;
    readonly language: string;
    readonly executionId?: string;
}): Promise<LanguageDeclarationAdmissionRun>;
