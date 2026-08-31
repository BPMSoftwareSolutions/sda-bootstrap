export class ComposeCanonicalScenarioGraphObligation {
    obligationId = "every-consumer-scenario-and-transition-is-explicit-valid-and-traceable";
    evaluate(evidence) {
        const scenarioIds = new Set(evidence.scenarios.map((scenario) => scenario.scenarioId));
        const complete = evidence.scenarios.length > 0 && evidence.transitions.every((transition) => scenarioIds.has(transition.from.scenarioId) && scenarioIds.has(transition.to.scenarioId));
        return complete
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "canonical-consumer-graph-has-complete-lineage", disposition: "SATISFIED" }] }
            : { kind: "NOT_SATISFIED", conditionEvidence: [{ conditionId: "canonical-consumer-graph-has-complete-lineage", disposition: "NOT_SATISFIED" }] };
    }
}
