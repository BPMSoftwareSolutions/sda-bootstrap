import { isNonEmptyString, isRecord, isSchemaAdmissionResult, isSourceFact } from "../../../conformance/model/runtime-contracts.js";
export function isGovernedPlacementInput(value) {
    if (!isRecord(value))
        return false;
    const isDocument = (document) => isRecord(document) &&
        isSourceFact(document["fact"], isRecord) &&
        (document["validation"] === undefined || isSourceFact(document["validation"], isSchemaAdmissionResult));
    return isNonEmptyString(value["corpusExecutionDirectory"]) &&
        isNonEmptyString(value["expectationsExecutionDirectory"]) &&
        ["fixtures", "expectations", "languageConformanceClaims", "sharedConformanceDocuments"]
            .every((field) => Array.isArray(value[field]) && value[field].every(isDocument));
}
export function isGovernedPlacementEvidence(value) {
    return isRecord(value) && typeof value["conforming"] === "boolean" &&
        Array.isArray(value["violations"]) && value["violations"].every((violation) => isRecord(violation) && ["K006A", "K006B", "K006C", "K006D", "K006E"].includes(String(violation["rule"])) &&
        isNonEmptyString(violation["file"]) && isNonEmptyString(violation["reason"]));
}
