import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { LanguageBindingDiscoveryEvidence } from "./model.js";
export declare class LanguageBindingDiscoveryObligation implements ObligationEvaluator<LanguageBindingDiscoveryEvidence> {
    readonly obligationId = "every-discoverable-manifest-is-represented-once";
    evaluate(evidence: LanguageBindingDiscoveryEvidence): ObligationDisposition;
}
