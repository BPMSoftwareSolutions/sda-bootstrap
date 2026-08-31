import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ComposeCanonicalScenarioGraphEvidence } from "./model.js";
export declare class ComposeCanonicalScenarioGraphObligation implements ObligationEvaluator<ComposeCanonicalScenarioGraphEvidence> {
    readonly obligationId = "every-consumer-scenario-and-transition-is-explicit-valid-and-traceable";
    evaluate(evidence: ComposeCanonicalScenarioGraphEvidence): ObligationDisposition;
}
