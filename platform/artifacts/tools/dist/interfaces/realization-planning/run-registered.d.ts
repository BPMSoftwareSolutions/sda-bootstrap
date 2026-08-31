import { type RegistryBackedRealizationPlanEvidence, type RegistryBackedRealizationPlanRequest, type RealizationPlanningRegistries } from "../../capabilities/realization-planning/resolve-registered-realization-plan/model.js";
import type { ResolveRegisteredRealizationPlanProvider } from "../../capabilities/realization-planning/resolve-registered-realization-plan/provider.js";
import type { ScenarioClosure } from "../../model/semantic-model.js";
export interface RegisteredRealizationPlanningRun {
    readonly closure: ScenarioClosure<RegistryBackedRealizationPlanEvidence>;
    readonly observations: readonly unknown[];
}
export declare function runRegisteredRealizationPlanning(options: {
    readonly repositoryRoot: string;
    readonly request: RegistryBackedRealizationPlanRequest;
    readonly registries: RealizationPlanningRegistries;
    readonly provider?: ResolveRegisteredRealizationPlanProvider;
    readonly executionId?: string;
}): Promise<RegisteredRealizationPlanningRun>;
