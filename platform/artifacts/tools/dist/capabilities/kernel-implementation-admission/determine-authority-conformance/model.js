import { isNonEmptyString, isRecord, isSourceFact, isStringArray } from "../../../conformance/model/runtime-contracts.js";
export function isAuthorityConformanceInput(value) {
    const isValidation = (candidate) => isRecord(candidate) && typeof candidate["valid"] === "boolean";
    const isCanonical = (candidate) => isRecord(candidate) && Array.isArray(candidate["assertions"]) && candidate["assertions"].every(isRecord);
    if (!isRecord(value))
        return false;
    return isNonEmptyString(value["language"]) &&
        isNonEmptyString(value["manifestPath"]) &&
        (value["manifest"] === null || isSourceFact(value["manifest"], isRecord)) &&
        (value["manifestValidation"] === null || isSourceFact(value["manifestValidation"], isValidation)) &&
        isSourceFact(value["canonicalAuthority"], isCanonical) &&
        (value["sourceInspection"] === null || isSourceFact(value["sourceInspection"], isAuthoritySourceInspection));
}
export function isAuthorityConformanceEvidence(value) {
    if (!isRecord(value))
        return false;
    const assertionArray = (candidate) => Array.isArray(candidate) && candidate.every(isRecord);
    return isNonEmptyString(value["language"]) &&
        isNonEmptyString(value["manifestPath"]) &&
        typeof value["manifestFound"] === "boolean" &&
        (value["manifestValid"] === undefined || typeof value["manifestValid"] === "boolean") &&
        Number.isInteger(value["assertionCount"]) && Number(value["assertionCount"]) >= 0 &&
        (value["canonicalAssertionCount"] === undefined || Number.isInteger(value["canonicalAssertionCount"])) &&
        (value["assertionSetConforming"] === undefined || typeof value["assertionSetConforming"] === "boolean") &&
        (value["missingAssertions"] === undefined || assertionArray(value["missingAssertions"])) &&
        (value["unexpectedAssertions"] === undefined || assertionArray(value["unexpectedAssertions"])) &&
        (value["sourceInspection"] === undefined || isAuthoritySourceInspection(value["sourceInspection"])) &&
        typeof value["conforming"] === "boolean";
}
function isAuthoritySourceInspection(value) {
    return isRecord(value) &&
        typeof value["conforming"] === "boolean" &&
        isStringArray(value["sourceRefs"]) &&
        (value["missingSourceRefs"] === undefined || isStringArray(value["missingSourceRefs"])) &&
        Array.isArray(value["checks"]) && value["checks"].every((check) => isRecord(check) && isNonEmptyString(check["value"]) && typeof check["observed"] === "boolean") &&
        (value["reason"] === undefined || typeof value["reason"] === "string");
}
