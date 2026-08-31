import { type ConstructDeterministicRealizationPlanInput, type RealizationPlanCompilationEvidence } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
import type { ScenarioClosure } from "../../model/semantic-model.js";
export interface RealizationPlanningRun {
    readonly closure: ScenarioClosure<RealizationPlanCompilationEvidence>;
    readonly observations: readonly unknown[];
}
export declare function runRealizationPlanning(options: {
    readonly repositoryRoot: string;
    readonly input: ConstructDeterministicRealizationPlanInput;
    readonly executionId?: string;
}): Promise<RealizationPlanningRun>;
