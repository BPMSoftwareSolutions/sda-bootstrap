import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { SchemaFamilyAdmissionEvidence } from "./model.js";
export declare class SchemaFamilyAdmissionObligation implements ObligationEvaluator<SchemaFamilyAdmissionEvidence> {
    readonly obligationId = "every-canonical-schema-and-reference-resolves-under-the-declared-dialect";
    evaluate(evidence: SchemaFamilyAdmissionEvidence): ObligationDisposition;
}
