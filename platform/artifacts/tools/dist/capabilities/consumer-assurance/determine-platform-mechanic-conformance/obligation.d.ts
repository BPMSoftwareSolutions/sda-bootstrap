import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { DeterminePlatformMechanicConformanceEvidence } from "./model.js";
export declare class DeterminePlatformMechanicConformanceObligation implements ObligationEvaluator<DeterminePlatformMechanicConformanceEvidence> {
    readonly obligationId = "every-mandatory-mechanic-has-current-implementation-and-conformance-evidence";
    evaluate(evidence: DeterminePlatformMechanicConformanceEvidence): ObligationDisposition;
}
