import { isNonEmptyString, isRecord, isSourceFact } from "../../../conformance/model/runtime-contracts.js";
function isFixtureArray(value) {
    return Array.isArray(value) && value.every(isRecord);
}
function isExecutionClosureObservation(value) {
    return isRecord(value) &&
        isNonEmptyString(value["language"]) &&
        typeof value["ran"] === "boolean" &&
        typeof value["conforming"] === "boolean" &&
        (value["disposition"] === undefined || ["SATISFIED", "NOT_SATISFIED", "NOT_OBSERVABLE"].includes(String(value["disposition"]))) &&
        (value["reason"] === undefined || typeof value["reason"] === "string") &&
        (value["fixtures"] === undefined || isFixtureArray(value["fixtures"]));
}
export const isExecutionClosureInput = (value) => isRecord(value) &&
    isNonEmptyString(value["language"]) &&
    isNonEmptyString(value["observationPath"]) &&
    (value["observation"] === null || isSourceFact(value["observation"], isExecutionClosureObservation));
export const isExecutionClosureEvidence = (value) => isRecord(value) &&
    isNonEmptyString(value["language"]) &&
    typeof value["ran"] === "boolean" &&
    typeof value["conforming"] === "boolean" &&
    (value["reason"] === undefined || typeof value["reason"] === "string") &&
    (value["fixtures"] === undefined || isFixtureArray(value["fixtures"]));
