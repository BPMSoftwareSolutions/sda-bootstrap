export class ConstructConsumerProjectionPlanObligation {
    obligationId = "every-requested-consumer-artifact-is-planned-without-publication";
    evaluate(evidence) {
        const paths = evidence.plan.files.map((file) => file.relativePath);
        const complete = evidence.plan.targets.every((target) => paths.some((relativePath) => relativePath.startsWith(`${target}/`))) &&
            paths.length === new Set(paths).size && evidence.plan.files.every((file) => file.digest.startsWith("sha256:") && file.sourcePointers.length > 0);
        return complete
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "consumer-plan-covers-shared-and-requested-target-artifacts", disposition: "SATISFIED" }] }
            : { kind: "NOT_SATISFIED", conditionEvidence: [{ conditionId: "consumer-plan-covers-shared-and-requested-target-artifacts", disposition: "NOT_SATISFIED" }] };
    }
}
