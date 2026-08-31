export function isProveQueryClosureInput(value) {
    const input = value;
    return !!input?.catalog && Array.isArray(input.observations);
}
export function isProveQueryClosureEvidence(value) {
    const evidence = value;
    return evidence?.conformanceType === "consumer-query-catalog-conformance.v1" && !!evidence.coverage && Array.isArray(evidence.queries);
}
