import { DigestRealizationProjector } from "../../adapters/realization-planning/digest-realization-projector.js";
import { OnDemandRealizationPolicyDecision } from "../../adapters/realization-planning/on-demand-realization-policy-decision.js";
import { ConstructDeterministicRealizationPlanProvider } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/provider.js";
import { ResolveRegisteredRealizationPlanProvider } from "../../capabilities/realization-planning/resolve-registered-realization-plan/provider.js";
export function createReferenceRealizationPlanProvider() {
    return new ConstructDeterministicRealizationPlanProvider(new OnDemandRealizationPolicyDecision(), new DigestRealizationProjector());
}
export function createReferenceRegisteredRealizationPlanProvider(registries) {
    return new ResolveRegisteredRealizationPlanProvider(registries, createReferenceRealizationPlanProvider());
}
