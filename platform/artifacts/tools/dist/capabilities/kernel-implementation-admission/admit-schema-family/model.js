import { isNonEmptyString, isRecord, isSourceFact, isStringArray } from "../../../conformance/model/runtime-contracts.js";
export const isSchemaFamilyAdmissionInput = (value) => isRecord(value) &&
    isNonEmptyString(value["schemasDirectory"]) &&
    Array.isArray(value["schemaFiles"]) &&
    value["schemaFiles"].every((file) => isSourceFact(file, isRecord)) &&
    isSourceFact(value["unresolved"], isStringArray);
export const isSchemaFamilyAdmissionEvidence = (value) => isRecord(value) &&
    isStringArray(value["files"]) &&
    isStringArray(value["unresolved"]) &&
    typeof value["valid"] === "boolean";
