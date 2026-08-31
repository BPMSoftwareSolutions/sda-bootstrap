import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { StageProjectedCandidateEvidence, StageProjectedCandidateInput } from "./model.js";
export declare class StageProjectedCandidateProvider implements ResponsibilityProvider<StageProjectedCandidateInput, StageProjectedCandidateEvidence> {
    readonly responsibilityId = "evaluate-isolated-candidate-staging";
    execute(input: StageProjectedCandidateInput): Promise<StageProjectedCandidateEvidence>;
}
