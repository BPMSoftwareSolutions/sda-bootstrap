import { isNonEmptyString, isRecord, isSourceFact } from "../../../conformance/model/runtime-contracts.js";
export function isLanguageObligationInput(value) {
    return isRecord(value) && Array.isArray(value["bindingFiles"]) &&
        value["bindingFiles"].every((binding) => isRecord(binding) &&
            isNonEmptyString(binding["language"]) && isSourceFact(binding["fact"], isRecord));
}
export function isLanguageObligationEvidence(value) {
    return isRecord(value) && Array.isArray(value["obligations"]) &&
        value["obligations"].every((obligation) => isRecord(obligation) &&
            isNonEmptyString(obligation["language"]) && isNonEmptyString(obligation["bindingPath"]) &&
            isRecord(obligation["binding"]) && isNonEmptyString(obligation["status"]) &&
            typeof obligation["isActiveObligation"] === "boolean");
}
