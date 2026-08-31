export function isProveProjectedSterilityBeforePublicationInput(value) {
    return value?.plan?.planType === "consumer-projection-plan.v1";
}
export function isProveProjectedSterilityBeforePublicationEvidence(value) {
    const evidence = value;
    return evidence?.conformanceType === "projected-artifact-mechanical-sterility.v1" &&
        Array.isArray(evidence.violations) && !!evidence.forbiddenExecutableMechanics;
}
