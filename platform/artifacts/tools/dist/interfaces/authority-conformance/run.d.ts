import { type AuthorityConformanceEvidence } from "../../capabilities/kernel-implementation-admission/determine-authority-conformance/model.js";
import type { ScenarioClosure } from "../../model/semantic-model.js";
export interface AuthorityConformanceRun {
    readonly closure: ScenarioClosure<AuthorityConformanceEvidence>;
    readonly observations: readonly unknown[];
}
export declare function runAuthorityConformance(options: {
    readonly repositoryRoot: string;
    readonly language: string;
    readonly executionId?: string;
}): Promise<AuthorityConformanceRun>;
