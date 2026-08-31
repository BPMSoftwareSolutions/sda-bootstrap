import { isNonEmptyString, isRecord, isSourceFact, isStringArray } from "../../../conformance/model/runtime-contracts.js";
export function isLanguageBindingDiscoveryInput(value) {
    if (!isRecord(value))
        return false;
    return isNonEmptyString(value["languagesDirectory"]) &&
        isSourceFact(value["languageDirectories"], isStringArray) &&
        Array.isArray(value["bindingFiles"]) && value["bindingFiles"].every((binding) => isRecord(binding) && isNonEmptyString(binding["language"]) && isSourceFact(binding["fact"], isRecord));
}
export function isLanguageBindingDiscoveryEvidence(value) {
    if (!isRecord(value))
        return false;
    return isNonEmptyString(value["languagesDirectory"]) &&
        Number.isInteger(value["expectedBindingFileCount"]) && Number(value["expectedBindingFileCount"]) >= 0 &&
        Array.isArray(value["discovered"]) && value["discovered"].every((binding) => isRecord(binding) && isNonEmptyString(binding["language"]) &&
        isNonEmptyString(binding["bindingPath"]) && isRecord(binding["binding"])) &&
        isStringArray(value["duplicateBindingPaths"]);
}
