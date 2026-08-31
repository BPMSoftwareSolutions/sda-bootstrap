import { type LanguageBindingDiscoveryEvidence } from "../../capabilities/workspace-governance/discover-language-bindings/model.js";
import type { ScenarioClosure } from "../../model/semantic-model.js";
export interface LanguageBindingDiscoveryRun {
    readonly closure: ScenarioClosure<LanguageBindingDiscoveryEvidence>;
    readonly observations: readonly unknown[];
}
export declare function runLanguageBindingDiscovery(options: {
    readonly repositoryRoot: string;
    readonly executionId?: string;
}): Promise<LanguageBindingDiscoveryRun>;
