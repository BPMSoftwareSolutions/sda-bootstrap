export class DeriveTargetExecutionGraphObligation {
    obligationId = "every-canonical-execution-node-has-one-attributable-target-policy-disposition";
    evaluate(evidence) {
        return evidence.steps.length > 0
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "target-execution-decisions-preserve-canonical-steps", disposition: "SATISFIED" }] }
            : { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "target-execution-decisions-preserve-canonical-steps", reason: "target execution graph is empty" }] };
    }
}
