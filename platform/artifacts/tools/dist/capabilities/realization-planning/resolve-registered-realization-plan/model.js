export function isRegistryBackedRealizationPlanRequest(value) {
    if (!value || typeof value !== "object")
        return false;
    const request = value;
    return request.requestType === "sda-registry-backed-realization-plan-request.v1" &&
        typeof request.requestId === "string" &&
        typeof request.planId === "string" &&
        !!request.intent &&
        !!request.capabilityRegistration &&
        !!request.capabilityRelease &&
        !!request.realizationPolicy &&
        Array.isArray(request.targets) &&
        request.targets.length > 0 &&
        !!request.planningSnapshot;
}
export function isRegistryBackedRealizationPlanEvidence(value) {
    if (!value || typeof value !== "object")
        return false;
    const evidence = value;
    if (evidence.evidenceType !== "sda-registry-backed-realization-plan-evidence.v1" ||
        !Array.isArray(evidence.resolutionDecisions) ||
        !Array.isArray(evidence.findings))
        return false;
    if (evidence.disposition === "PLANNED") {
        return evidence.findings.length === 0 && !!evidence.plan && typeof evidence.plan === "object";
    }
    return evidence.disposition === "BLOCKED" && evidence.findings.length > 0 && evidence.plan === undefined;
}
