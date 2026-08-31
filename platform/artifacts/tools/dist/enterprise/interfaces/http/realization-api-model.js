import { sha256Digest } from "../../control-plane/canonical-json.js";
export class RealizationPlanIdempotencyConflictError extends Error {
    tenantId;
    idempotencyKey;
    constructor(tenantId, idempotencyKey) {
        super(`Realization idempotency key '${idempotencyKey}' has already admitted different intent for tenant '${tenantId}'.`);
        this.tenantId = tenantId;
        this.idempotencyKey = idempotencyKey;
        this.name = "RealizationPlanIdempotencyConflictError";
    }
}
export class RegistryBackedRealizationRequestRejectedError extends Error {
    findings;
    constructor(findings = []) {
        super("Registry-backed realization request failed internal contract admission.");
        this.findings = findings;
        this.name = "RegistryBackedRealizationRequestRejectedError";
    }
}
export function isNodeRealizationApiReferenceHostProfile(value) {
    if (!value || typeof value !== "object")
        return false;
    const candidate = value;
    const digestable = { ...value };
    delete digestable["hostProfileDigest"];
    return candidate.profileType === "sda-node-realization-api-reference-host-profile.v1" &&
        candidate.apiId === "sda-realization-api" &&
        typeof candidate.hostProfileDigest === "string" &&
        candidate.hostProfileDigest === sha256Digest(digestable);
}
