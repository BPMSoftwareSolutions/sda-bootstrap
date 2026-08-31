import { sha256Digest } from "../../control-plane/canonical-json.js";
export class ApiProblemError extends Error {
    status;
    reasonCode;
    title;
    safeDetail;
    constructor(status, reasonCode, title, safeDetail) {
        super(safeDetail ?? title);
        this.status = status;
        this.reasonCode = reasonCode;
        this.title = title;
        this.safeDetail = safeDetail;
        this.name = "ApiProblemError";
    }
}
export function isNodeApiReferenceHostProfile(value) {
    if (!value || typeof value !== "object")
        return false;
    const candidate = value;
    const digestable = { ...value };
    delete digestable["hostProfileDigest"];
    return candidate.profileType === "sda-node-api-reference-host-profile.v1" &&
        candidate.apiId === "sda-execution-api" &&
        typeof candidate.hostProfileDigest === "string" &&
        candidate.hostProfileDigest === sha256Digest(digestable);
}
