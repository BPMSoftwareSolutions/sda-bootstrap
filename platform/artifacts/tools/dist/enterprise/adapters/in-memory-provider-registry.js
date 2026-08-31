export class InMemoryProviderRegistry {
    providers = new Map();
    evaluators = new Map();
    registerProvider(provider) {
        this.providers.set(provider.providerId, provider);
    }
    registerEvaluator(evaluator) {
        this.evaluators.set(evaluator.evaluatorId, evaluator);
    }
    resolveProvider(providerId) {
        return this.providers.get(providerId) ?? null;
    }
    resolveEvaluator(evaluatorId) {
        return this.evaluators.get(evaluatorId) ?? null;
    }
}
