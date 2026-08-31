export class ReproduceTargetExecutionVectorObligation {
    obligationId = "every-target-execution-node-has-a-deterministic-embodiment";
    evaluate(evidence) {
        const paths = evidence.files.map((file) => file.relativePath);
        const satisfied = paths.length > 0 && new Set(paths).size === paths.length && evidence.files.every((file) => file.digest.startsWith("sha256:"));
        return satisfied
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "execution-plan-is-complete-and-deterministic", disposition: "SATISFIED" }] }
            : { kind: "NOT_SATISFIED", conditionEvidence: [{ conditionId: "execution-plan-is-complete-and-deterministic", disposition: "NOT_SATISFIED" }] };
    }
}
