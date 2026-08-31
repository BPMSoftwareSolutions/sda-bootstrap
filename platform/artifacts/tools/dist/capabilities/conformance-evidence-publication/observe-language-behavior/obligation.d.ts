import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ObserveLanguageBehaviorEvidence } from "./model.js";
export declare class ObserveLanguageBehaviorObligation implements ObligationEvaluator<ObserveLanguageBehaviorEvidence> {
    readonly obligationId = "every-targeted-language-produces-evidence-or-an-explicit-not-observable-reason";
    evaluate(evidence: ObserveLanguageBehaviorEvidence): ObligationDisposition;
}
