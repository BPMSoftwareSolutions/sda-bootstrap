export function isProveMechanicalSterilityInput(value) {
    return value?.plan?.planType === "consumer-projection-plan.v1";
}
export function isProveMechanicalSterilityEvidence(value) {
    return value?.conformanceType === "projected-artifact-mechanical-sterility.v1";
}
