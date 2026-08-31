import { isNonEmptyString, isRecord, isSourceFact } from "../../../conformance/model/runtime-contracts.js";
export function isBehavioralConformanceEvidence(value) {
    if (!isRecord(value))
        return false;
    return isNonEmptyString(value["language"]) &&
        typeof value["toolchainAvailable"] === "boolean" &&
        typeof value["ran"] === "boolean" &&
        typeof value["conforming"] === "boolean" &&
        (value["exitCode"] === undefined || value["exitCode"] === null || typeof value["exitCode"] === "number") &&
        (value["reason"] === undefined || typeof value["reason"] === "string") &&
        (value["summary"] === undefined || typeof value["summary"] === "string");
}
export const isBehavioralConformanceInput = (value) => isRecord(value) &&
    isNonEmptyString(value["language"]) &&
    isNonEmptyString(value["observationPath"]) &&
    (value["observation"] === null || isSourceFact(value["observation"], isBehavioralConformanceEvidence));
