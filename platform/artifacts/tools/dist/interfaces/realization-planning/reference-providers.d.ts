import { ConstructDeterministicRealizationPlanProvider } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/provider.js";
import type { RealizationPlanningRegistries } from "../../capabilities/realization-planning/resolve-registered-realization-plan/model.js";
import { ResolveRegisteredRealizationPlanProvider } from "../../capabilities/realization-planning/resolve-registered-realization-plan/provider.js";
export declare function createReferenceRealizationPlanProvider(): ConstructDeterministicRealizationPlanProvider;
export declare function createReferenceRegisteredRealizationPlanProvider(registries: RealizationPlanningRegistries): ResolveRegisteredRealizationPlanProvider;
