import { sha256Digest } from "../../../enterprise/control-plane/canonical-json.js";
export function digestWithoutField(value, field) {
    const digestable = { ...value };
    delete digestable[field];
    return sha256Digest(digestable);
}
export function isDeriveApiOperationGraphInput(value) {
    if (!value || typeof value !== "object")
        return false;
    const candidate = value;
    return candidate.inputType === "sda-api-operation-graph-derivation-input.v1" &&
        Array.isArray(candidate.interfaceAuthorities) && candidate.interfaceAuthorities.length > 0 &&
        Array.isArray(candidate.capabilities) && candidate.capabilities.length > 0 &&
        Array.isArray(candidate.contracts) && candidate.contracts.length > 0;
}
export function isApiOperationGraphEvidence(value) {
    if (!value || typeof value !== "object")
        return false;
    const graph = value;
    return graph.graphType === "sda-api-operation-graph.v1" &&
        Array.isArray(graph.apis) && graph.apis.length > 0 &&
        Array.isArray(graph.contracts) && graph.contracts.length > 0 &&
        typeof graph.graphDigest === "string" &&
        graph.graphDigest === digestWithoutField(value, "graphDigest");
}
