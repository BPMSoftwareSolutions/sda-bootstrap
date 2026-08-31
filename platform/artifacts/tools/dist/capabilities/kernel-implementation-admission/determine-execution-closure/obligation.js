export class ExecutionClosureObligation {
    obligationId = "every-observed-execution-is-gap-free-or-has-a-precise-closure-finding";
    evaluate(evidence) { if (!evidence.ran)
        return { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "execution-testimony-is-gap-free-and-lineage-consistent", reason: evidence.reason ?? "execution closure was not observed" }] }; return { kind: evidence.conforming ? "SATISFIED" : "NOT_SATISFIED", conditionEvidence: [{ conditionId: "execution-testimony-is-gap-free-and-lineage-consistent", disposition: evidence.conforming ? "SATISFIED" : "NOT_SATISFIED" }] }; }
}
