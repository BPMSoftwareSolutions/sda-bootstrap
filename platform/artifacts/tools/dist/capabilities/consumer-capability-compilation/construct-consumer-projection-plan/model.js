export function isConstructConsumerProjectionPlanInput(value) {
    const input = value;
    return input?.sourceAdmission?.evidenceType === "consumer-source-admission-evidence.v1" &&
        input.graph?.evidenceType === "canonical-consumer-scenario-graph-evidence.v1" &&
        input.responsibilityEvidence?.evidenceType === "platform-responsibility-resolution-evidence.v1" &&
        Array.isArray(input.targets) && typeof input.preserveUntargeted === "boolean" &&
        (input.proofProfile === undefined || input.proofProfile.proofProfileType === "consumer-cross-apply-proof-profile.v1");
}
export function isConstructConsumerProjectionPlanEvidence(value) {
    const evidence = value;
    return evidence?.evidenceType === "consumer-projection-plan-evidence.v1" && evidence.plan?.planType === "consumer-projection-plan.v1" &&
        Array.isArray(evidence.plan.files) && !!evidence.capability && !!evidence.queries;
}
