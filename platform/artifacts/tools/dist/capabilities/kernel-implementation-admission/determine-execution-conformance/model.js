import { isNonEmptyString, isRecord, isSchemaAdmissionResult, isSourceFact, isStringArray } from "../../../conformance/model/runtime-contracts.js";
function isStepDisposition(value) {
    return isRecord(value) && isNonEmptyString(value["stepId"]) &&
        (value["status"] === "PASS" || value["status"] === "MISSING");
}
export const isExecutionConformanceInput = (value) => isRecord(value) &&
    isNonEmptyString(value["language"]) &&
    isNonEmptyString(value["manifestPath"]) &&
    (value["manifest"] === null || isSourceFact(value["manifest"], isRecord)) &&
    (value["manifestValidation"] === null || isSourceFact(value["manifestValidation"], isSchemaAdmissionResult)) &&
    isSourceFact(value["canonicalStepIds"], isStringArray);
export const isExecutionConformanceEvidence = (value) => isRecord(value) &&
    isNonEmptyString(value["language"]) &&
    isNonEmptyString(value["manifestPath"]) &&
    typeof value["manifestFound"] === "boolean" &&
    (value["manifestValid"] === undefined || typeof value["manifestValid"] === "boolean") &&
    Array.isArray(value["steps"]) && value["steps"].every(isStepDisposition) &&
    typeof value["conforming"] === "boolean";
