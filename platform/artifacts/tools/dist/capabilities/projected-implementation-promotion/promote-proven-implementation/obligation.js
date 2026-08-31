export class PromoteProvenImplementationObligation {
    obligationId = "publication-is-atomic-and-manifest-matches-promoted-bytes";
    evaluate(evidence) {
        const satisfied = evidence.proofConforming && evidence.committed && evidence.exactManifest;
        return { kind: satisfied ? "SATISFIED" : "NOT_SATISFIED", conditionEvidence: [{ conditionId: "proven-plan-is-atomically-published-with-exact-manifest", disposition: satisfied ? "SATISFIED" : "NOT_SATISFIED" }] };
    }
}
