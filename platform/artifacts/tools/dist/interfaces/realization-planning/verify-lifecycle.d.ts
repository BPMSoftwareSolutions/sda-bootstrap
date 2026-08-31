import { type RealizationLifecycleContractEvidence } from "../../capabilities/realization-planning/verify-realization-lifecycle-contracts/model.js";
import type { RealizationLifecycleFixture } from "../../model/realization-lifecycle.js";
import type { ScenarioClosure } from "../../model/semantic-model.js";
export interface RealizationLifecycleVerificationRun {
    readonly closure: ScenarioClosure<RealizationLifecycleContractEvidence>;
    readonly observations: readonly unknown[];
}
export declare function verifyRealizationLifecycle(options: {
    readonly repositoryRoot: string;
    readonly fixture: RealizationLifecycleFixture;
    readonly executionId?: string;
}): Promise<RealizationLifecycleVerificationRun>;
