import type { EnterpriseObservationEvaluator, EnterpriseProviderRegistry, EnterpriseResponsibilityProvider } from "../data-plane/ports.js";
export declare class InMemoryProviderRegistry implements EnterpriseProviderRegistry {
    private readonly providers;
    private readonly evaluators;
    registerProvider(provider: EnterpriseResponsibilityProvider): void;
    registerEvaluator(evaluator: EnterpriseObservationEvaluator): void;
    resolveProvider(providerId: string): EnterpriseResponsibilityProvider | null;
    resolveEvaluator(evaluatorId: string): EnterpriseObservationEvaluator | null;
}
