import { isNonEmptyString, isRecord, isSchemaAdmissionResult, isSourceFact, isStringArray } from "../../../conformance/model/runtime-contracts.js";
function isShapeDisposition(value) {
    return isRecord(value) && isNonEmptyString(value["objectId"]) &&
        (value["status"] === "PASS" || value["status"] === "MISSING");
}
export const isShapeConformanceInput = (value) => isRecord(value) &&
    isNonEmptyString(value["language"]) &&
    isNonEmptyString(value["manifestPath"]) &&
    (value["manifest"] === null || isSourceFact(value["manifest"], isRecord)) &&
    (value["manifestValidation"] === null || isSourceFact(value["manifestValidation"], isSchemaAdmissionResult)) &&
    isSourceFact(value["canonicalObjectIds"], isStringArray);
export const isShapeConformanceEvidence = (value) => isRecord(value) &&
    isNonEmptyString(value["language"]) &&
    isNonEmptyString(value["manifestPath"]) &&
    typeof value["manifestFound"] === "boolean" &&
    typeof value["manifestValid"] === "boolean" &&
    (value["errors"] === undefined || isStringArray(value["errors"])) &&
    Array.isArray(value["objects"]) && value["objects"].every(isShapeDisposition) &&
    typeof value["conforming"] === "boolean";
