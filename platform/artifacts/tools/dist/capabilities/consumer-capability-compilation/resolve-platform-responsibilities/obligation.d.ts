import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ResolvePlatformResponsibilitiesEvidence } from "./model.js";
export declare class ResolvePlatformResponsibilitiesObligation implements ObligationEvaluator<ResolvePlatformResponsibilitiesEvidence> {
    readonly obligationId = "every-required-mechanic-has-one-resolution-or-a-precise-gap";
    evaluate(evidence: ResolvePlatformResponsibilitiesEvidence): ObligationDisposition;
}
