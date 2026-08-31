import { isNonEmptyString, isRecord, isSchemaAdmissionResult, isSourceFact, isStringArray } from "../../../conformance/model/runtime-contracts.js";
export const isExecutionVectorAdmissionInput = (value) => isRecord(value) &&
    isNonEmptyString(value["executionVectorPath"]) &&
    (value["executionVector"] === null || isSourceFact(value["executionVector"], isRecord)) &&
    (value["validation"] === null || isSourceFact(value["validation"], isSchemaAdmissionResult));
export const isExecutionVectorAdmissionEvidence = (value) => isRecord(value) &&
    isNonEmptyString(value["executionVectorPath"]) &&
    typeof value["found"] === "boolean" &&
    typeof value["valid"] === "boolean" &&
    isStringArray(value["errors"]);
