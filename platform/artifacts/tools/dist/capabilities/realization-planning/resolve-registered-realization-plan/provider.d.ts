import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import { ConstructDeterministicRealizationPlanProvider } from "../construct-deterministic-realization-plan/provider.js";
import type { RegistryBackedRealizationPlanEvidence, RegistryBackedRealizationPlanRequest, RealizationPlanningRegistries } from "./model.js";
export declare class ResolveRegisteredRealizationPlanProvider implements ResponsibilityProvider<RegistryBackedRealizationPlanRequest, RegistryBackedRealizationPlanEvidence> {
    private readonly registries;
    private readonly compiler;
    readonly responsibilityId = "resolve-registry-selectors-and-construct-plan";
    constructor(registries: RealizationPlanningRegistries, compiler: ConstructDeterministicRealizationPlanProvider);
    execute(request: RegistryBackedRealizationPlanRequest): Promise<RegistryBackedRealizationPlanEvidence>;
}
