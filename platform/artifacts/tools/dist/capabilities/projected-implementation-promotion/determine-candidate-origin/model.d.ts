import type { ProjectionPlan } from "../../../projection/model/projection-plan.js";
export interface DetermineCandidateOriginInput {
    readonly plan: ProjectionPlan;
}
export interface CandidateOriginEvidence {
    readonly origin: "PROJECTED" | "HAND_AUTHORED" | "MIXED" | "UNKNOWN";
    readonly projectedCount: number;
    readonly handWrittenCount: number;
}
export declare const isDetermineCandidateOriginInput: (value: unknown) => value is DetermineCandidateOriginInput;
export declare const isCandidateOriginEvidence: (value: unknown) => value is CandidateOriginEvidence;
