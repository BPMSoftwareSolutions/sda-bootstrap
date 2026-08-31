import { type GovernedPlacementEvidence } from "../../capabilities/workspace-governance/verify-governed-placement/model.js";
import type { ScenarioClosure } from "../../model/semantic-model.js";
export interface WorkspacePlacementVerificationRun {
    readonly closure: ScenarioClosure<GovernedPlacementEvidence>;
    readonly observations: readonly unknown[];
}
export declare function runWorkspacePlacementVerification(options: {
    readonly repositoryRoot: string;
    readonly executionId?: string;
}): Promise<WorkspacePlacementVerificationRun>;
