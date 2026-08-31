import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { BehavioralConformanceEvidence } from "./model.js";
export declare class BehavioralConformanceObligation implements ObligationEvaluator<BehavioralConformanceEvidence> {
    readonly obligationId = "every-required-fixture-has-attributable-behavior-evidence-or-an-observation-gap";
    evaluate(evidence: BehavioralConformanceEvidence): ObligationDisposition;
}
