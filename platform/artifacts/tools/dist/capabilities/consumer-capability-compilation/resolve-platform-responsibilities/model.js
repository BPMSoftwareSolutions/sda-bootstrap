export function isResolvePlatformResponsibilitiesInput(value) {
    const input = value;
    return input?.sourceAdmission?.evidenceType === "consumer-source-admission-evidence.v1" &&
        input.graph?.evidenceType === "canonical-consumer-scenario-graph-evidence.v1" && Array.isArray(input.targets) && input.targets.length > 0;
}
export function isResolvePlatformResponsibilitiesEvidence(value) {
    const evidence = value;
    return evidence?.evidenceType === "platform-responsibility-resolution-evidence.v1" && !!evidence.resolutions &&
        Array.isArray(evidence.admittedPlatformCapabilities) && (evidence.disposition === "RESOLVED" || evidence.disposition === "MISSING");
}
