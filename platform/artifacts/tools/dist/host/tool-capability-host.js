export class ToolCapabilityHost {
    runner;
    contracts;
    observer;
    constructor(runner, contracts, observer) {
        this.runner = runner;
        this.contracts = contracts;
        this.observer = observer;
    }
    async executeScenario(options) {
        if (options.scenario.event.responsibility.responsibilityId !== options.provider.responsibilityId) {
            throw new Error(`Provider '${options.provider.responsibilityId}' cannot execute responsibility ` +
                `'${options.scenario.event.responsibility.responsibilityId}'.`);
        }
        if (options.scenario.outcome.obligation.obligationId !== options.obligation.obligationId) {
            throw new Error(`Evaluator '${options.obligation.obligationId}' cannot close obligation ` +
                `'${options.scenario.outcome.obligation.obligationId}'.`);
        }
        const rootExecutionId = options.rootExecutionId ?? options.executionId;
        const execution = await this.runner.run({
            scenario: options.scenario,
            input: options.input,
            provider: options.provider,
            contracts: this.contracts,
            observer: this.observer,
            executionId: options.executionId,
            rootExecutionId,
            ...(options.signal ? { signal: options.signal } : {})
        });
        if (execution.disposition === "rejected" || execution.disposition === "failed" || execution.outcome === null) {
            return {
                scenarioId: options.scenario.scenarioId,
                executionId: execution.executionId,
                kernelDisposition: execution.disposition,
                evidence: execution.outcome,
                obligationDisposition: {
                    kind: "NOT_OBSERVABLE",
                    reasons: [{ reason: `kernel execution closed with '${execution.disposition}'` }]
                },
                experienceDisposition: "NOT_OBSERVABLE"
            };
        }
        const obligationDisposition = options.obligation.evaluate(execution.outcome);
        return {
            scenarioId: options.scenario.scenarioId,
            executionId: execution.executionId,
            kernelDisposition: execution.disposition,
            evidence: execution.outcome,
            obligationDisposition,
            experienceDisposition: obligationDisposition.kind === "SATISFIED"
                ? "REALIZED"
                : obligationDisposition.kind === "NOT_SATISFIED"
                    ? "NOT_REALIZED"
                    : "NOT_OBSERVABLE"
        };
    }
}
