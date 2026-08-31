import { type LanguageObligationEvidence } from "../../capabilities/workspace-governance/determine-active-language-obligations/model.js";
import type { ScenarioClosure } from "../../model/semantic-model.js";
export interface LanguageObligationDeterminationRun {
    readonly closure: ScenarioClosure<LanguageObligationEvidence>;
    readonly observations: readonly unknown[];
}
export declare function runLanguageObligationDetermination(options: {
    readonly repositoryRoot: string;
    readonly executionId?: string;
}): Promise<LanguageObligationDeterminationRun>;
