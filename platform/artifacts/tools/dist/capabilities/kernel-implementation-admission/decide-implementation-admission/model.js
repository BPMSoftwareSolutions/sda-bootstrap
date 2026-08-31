import { isNonEmptyString, isRecord, isStringArray } from "../../../conformance/model/runtime-contracts.js";
function hasBoolean(value, field) {
    return isRecord(value) && typeof value[field] === "boolean";
}
function isOrigin(value) {
    return isRecord(value) && ["HAND_AUTHORED", "PROJECTED", "MIXED", "UNKNOWN"].includes(String(value["origin"]));
}
function isAdmissionObligation(value) {
    return isRecord(value) &&
        isNonEmptyString(value["id"]) &&
        isNonEmptyString(value["group"]) &&
        isNonEmptyString(value["label"]) &&
        ["PASS", "FAIL", "NOT_READY"].includes(String(value["disposition"])) &&
        isNonEmptyString(value["scenarioId"]) &&
        isNonEmptyString(value["obligationId"]) &&
        isNonEmptyString(value["evidenceRef"]);
}
export const isImplementationAdmissionInput = (value) => isRecord(value) &&
    value["evidenceSetType"] === "conformance-evidence-set.v1" &&
    isNonEmptyString(value["language"]) &&
    isNonEmptyString(value["implementationId"]) &&
    isRecord(value["evidenceRefs"]) &&
    Object.values(value["evidenceRefs"]).every(isNonEmptyString) &&
    hasBoolean(value["workspacePlacement"], "conforming") &&
    hasBoolean(value["kernelSpecification"], "valid") &&
    hasBoolean(value["schemaFamily"], "valid") &&
    hasBoolean(value["executionVector"], "valid") &&
    hasBoolean(value["languageDeclaration"], "bindingValid") &&
    hasBoolean(value["languageDeclaration"], "conformanceClaimValid") &&
    hasBoolean(value["shape"], "conforming") &&
    hasBoolean(value["execution"], "conforming") &&
    hasBoolean(value["authority"], "conforming") &&
    hasBoolean(value["behavioral"], "ran") &&
    hasBoolean(value["behavioral"], "conforming") &&
    hasBoolean(value["executionClosure"], "ran") &&
    hasBoolean(value["executionClosure"], "conforming") &&
    isOrigin(value["implementationOrigin"]);
export const isImplementationAdmissionEvidence = (value) => isRecord(value) &&
    isNonEmptyString(value["language"]) &&
    isNonEmptyString(value["implementationId"]) &&
    value["evaluationDisposition"] === "COMPLETE" &&
    (value["admissionDisposition"] === "ADMITTED" || value["admissionDisposition"] === "BLOCKED") &&
    isOrigin(value["implementationOrigin"]) &&
    Array.isArray(value["obligations"]) && value["obligations"].every(isAdmissionObligation) &&
    isStringArray(value["blockingObligations"]) &&
    isStringArray(value["notReadyObligations"]) &&
    isRecord(value["details"]);
