import { sha256Digest } from "../../../enterprise/control-plane/canonical-json.js";
import { digestWithoutField } from "../derive-api-operation-graph/model.js";
export function isOpenApiProjectionProfile(value) {
    if (!value || typeof value !== "object")
        return false;
    const candidate = value;
    return candidate.profileType === "sda-openapi-sdk-profile.v1" &&
        candidate.openapiVersion === "3.1.2" &&
        Array.isArray(candidate.allowedMethods) &&
        Array.isArray(candidate.allowedParameterLocations) &&
        Array.isArray(candidate.allowedSchemaKeywords) &&
        typeof candidate.profileDigest === "string" &&
        candidate.profileDigest === digestWithoutField(value, "profileDigest");
}
export function isProjectOpenApiDescriptionInput(value) {
    if (!value || typeof value !== "object")
        return false;
    const candidate = value;
    return candidate.inputType === "sda-openapi-description-projection-input.v1" &&
        !!candidate.operationGraph && Array.isArray(candidate.contracts) && candidate.contracts.length > 0 &&
        isOpenApiProjectionProfile(candidate.profile);
}
export function isOpenApiProjectionEvidence(value) {
    if (!value || typeof value !== "object")
        return false;
    const candidate = value;
    return candidate.evidenceType === "sda-openapi-projection-evidence.v1" &&
        !!candidate.document && candidate.document.openapi === "3.1.2" &&
        candidate.equivalence?.disposition === "EQUIVALENT" &&
        candidate.documentDigest === sha256Digest(candidate.document) &&
        candidate.evidenceDigest === digestWithoutField(value, "evidenceDigest");
}
