import { isNonEmptyString, isRecord } from "../../../conformance/model/runtime-contracts.js";
import { isBehavioralConformanceEvidence } from "../../kernel-implementation-admission/determine-behavioral-conformance/model.js";
export const isObserveLanguageBehaviorInput = (value) => {
    if (!isRecord(value) || !isRecord(value["obligation"]))
        return false;
    const obligation = value["obligation"];
    return isNonEmptyString(obligation["language"]) &&
        isNonEmptyString(obligation["bindingPath"]) &&
        isRecord(obligation["binding"]) &&
        isNonEmptyString(obligation["binding"]["implementationId"]) &&
        isNonEmptyString(obligation["status"]) &&
        typeof obligation["isActiveObligation"] === "boolean";
};
export const isObserveLanguageBehaviorEvidence = isBehavioralConformanceEvidence;
