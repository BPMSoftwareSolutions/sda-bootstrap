import { isNonEmptyString, isRecord, isSchemaAdmissionResult, isSourceFact, isStringArray } from "../../../conformance/model/runtime-contracts.js";
export function isLanguageDeclarationInput(value) {
    return isRecord(value) && isNonEmptyString(value["language"]) &&
        isSourceFact(value["binding"], isRecord) &&
        isSourceFact(value["bindingValidation"], isSchemaAdmissionResult) &&
        isNonEmptyString(value["manifestPath"]) &&
        (value["manifest"] === null || isSourceFact(value["manifest"], isRecord)) &&
        (value["manifestValidation"] === null || isSourceFact(value["manifestValidation"], isSchemaAdmissionResult));
}
export function isLanguageDeclarationEvidence(value) {
    return isRecord(value) && typeof value["bindingValid"] === "boolean" &&
        isStringArray(value["bindingErrors"]) && isNonEmptyString(value["manifestPath"]) &&
        typeof value["conformanceClaimValid"] === "boolean" && isStringArray(value["conformanceClaimErrors"]);
}
