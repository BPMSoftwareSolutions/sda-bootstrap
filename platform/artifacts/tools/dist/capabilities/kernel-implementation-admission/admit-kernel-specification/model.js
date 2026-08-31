import { isNonEmptyString, isRecord, isSchemaAdmissionResult, isSourceFact, isStringArray } from "../../../conformance/model/runtime-contracts.js";
export const isKernelSpecificationAdmissionInput = (value) => isRecord(value) &&
    isNonEmptyString(value["specificationPath"]) &&
    (value["specification"] === null || isSourceFact(value["specification"], isRecord)) &&
    (value["validation"] === null || isSourceFact(value["validation"], isSchemaAdmissionResult));
export const isKernelSpecificationAdmissionEvidence = (value) => isRecord(value) &&
    isNonEmptyString(value["specificationPath"]) &&
    typeof value["found"] === "boolean" &&
    typeof value["valid"] === "boolean" &&
    isStringArray(value["errors"]);
