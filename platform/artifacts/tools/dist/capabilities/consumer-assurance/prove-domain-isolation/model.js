export function isProveDomainIsolationInput(value) {
    const sources = value?.sources;
    return !!sources && typeof sources.sourceRef === "string" && typeof sources.digest === "string" && Array.isArray(sources.value);
}
export function isProveDomainIsolationEvidence(value) {
    const evidence = value;
    return evidence?.evidenceType === "consumer-domain-isolation-evidence.v1" && typeof evidence.scannedFiles === "number" && Array.isArray(evidence.violations);
}
