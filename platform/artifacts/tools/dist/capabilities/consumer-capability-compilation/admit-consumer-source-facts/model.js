export function isAdmitConsumerSourceFactsInput(value) {
    const input = value;
    return !!input?.facts && input.facts.factsType === "consumer-workspace-facts.v1" && typeof input.facts.workspaceRoot === "string";
}
export function isAdmitConsumerSourceFactsEvidence(value) {
    const evidence = value;
    return evidence?.evidenceType === "consumer-source-admission-evidence.v1" && evidence.disposition === "ADMITTED" &&
        Array.isArray(evidence.sourceFacts) && !!evidence.facts;
}
