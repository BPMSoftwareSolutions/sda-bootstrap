import { isNonEmptyString, isRecord, isSourceFact } from "../../../conformance/model/runtime-contracts.js";
import { isImplementationAdmissionEvidence } from "../../kernel-implementation-admission/decide-implementation-admission/model.js";
export const isPublishImplementationEvidenceInput = (value) => isRecord(value) &&
    isImplementationAdmissionEvidence(value["admission"]) &&
    isSourceFact(value["generatedAt"], isNonEmptyString) &&
    /^sha256:[0-9a-f]{64}$/.test(String(value["proofInputDigest"]));
export const isPublishedImplementationEvidence = (value) => isRecord(value) &&
    value["conformanceType"] === "scenario-kernel-admission-result.v1" &&
    isNonEmptyString(value["generatedAt"]) &&
    /^sha256:[0-9a-f]{64}$/.test(String(value["proofInputDigest"])) &&
    isImplementationAdmissionEvidence(value);
