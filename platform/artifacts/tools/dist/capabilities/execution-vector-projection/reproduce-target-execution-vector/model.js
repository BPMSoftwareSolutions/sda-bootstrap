export function isReproduceTargetExecutionVectorInput(value) {
    if (!value || typeof value !== "object")
        return false;
    const input = value;
    return typeof input.targetGraph === "object" && typeof input.profile === "object";
}
export function isExecutionProjectionPlanEvidence(value) {
    return !!value && typeof value === "object" && value.planType === "projection-plan.v1";
}
