import { isNonEmptyString, isRecord } from "../../../conformance/model/runtime-contracts.js";
import { isPublishedImplementationEvidence } from "../publish-implementation-evidence/model.js";
function isFixture(value) {
    return isRecord(value) && isNonEmptyString(value["fixtureId"]) && isNonEmptyString(value["label"]);
}
function isEquivalenceRow(value) {
    return isRecord(value) &&
        isNonEmptyString(value["fixtureId"]) &&
        isNonEmptyString(value["label"]) &&
        isRecord(value["perLanguage"]) &&
        Object.values(value["perLanguage"]).every((item) => ["PASS", "UNVERIFIED", "NOT_READY"].includes(String(item)));
}
export const isCrossLanguageEquivalenceInput = (value) => isRecord(value) &&
    Array.isArray(value["admissions"]) && value["admissions"].every(isPublishedImplementationEvidence) &&
    Array.isArray(value["fixtures"]) && value["fixtures"].every(isFixture);
export const isCrossLanguageEquivalenceEvidence = (value) => isRecord(value) &&
    Array.isArray(value["languages"]) && value["languages"].every(isNonEmptyString) &&
    Array.isArray(value["rows"]) && value["rows"].every(isEquivalenceRow) &&
    Number.isInteger(value["equivalentCount"]) && Number(value["equivalentCount"]) >= 0 &&
    Number.isInteger(value["totalFixtures"]) && Number(value["totalFixtures"]) >= 0;
