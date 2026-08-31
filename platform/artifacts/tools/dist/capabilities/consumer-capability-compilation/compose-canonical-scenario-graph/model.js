export function isComposeCanonicalScenarioGraphInput(value) {
    return value?.sourceAdmission?.evidenceType === "consumer-source-admission-evidence.v1";
}
export function isComposeCanonicalScenarioGraphEvidence(value) {
    const evidence = value;
    return evidence?.evidenceType === "canonical-consumer-scenario-graph-evidence.v1" && !!evidence.capability &&
        Array.isArray(evidence.scenarios) && Array.isArray(evidence.transitions) && Array.isArray(evidence.sourceRefs);
}
