export class ProveProjectedExecutionBehaviorObligation {
    obligationId = "every-fixture-has-equivalent-behavior-or-an-explicit-evidence-gap";
    evaluate(evidence) {
        if (!evidence.toolchain.ran || !evidence.behavior.ran) {
            return { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "projected-execution-compiles-and-preserves-fixture-behavior", reason: evidence.toolchain.reason ?? evidence.behavior.reason ?? "toolchain unavailable" }] };
        }
        const satisfied = evidence.toolchain.conforming && evidence.behavior.conforming && evidence.fixtureCount > 0;
        return { kind: satisfied ? "SATISFIED" : "NOT_SATISFIED", conditionEvidence: [{
                    conditionId: "projected-execution-compiles-and-preserves-fixture-behavior",
                    disposition: satisfied ? "SATISFIED" : "NOT_SATISFIED"
                }] };
    }
}
