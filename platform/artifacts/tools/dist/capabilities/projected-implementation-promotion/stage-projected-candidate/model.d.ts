import type { ProjectionPlan } from "../../../projection/model/projection-plan.js";
export interface StageProjectedCandidateInput {
    readonly plan: ProjectionPlan;
    readonly stagingDirectory: string;
    readonly admittedBytesModified: boolean;
}
export type StageProjectedCandidateEvidence = StageProjectedCandidateInput;
export declare const isStageProjectedCandidateInput: (value: unknown) => value is StageProjectedCandidateInput;
export declare const isStageProjectedCandidateEvidence: (value: unknown) => value is StageProjectedCandidateInput;
