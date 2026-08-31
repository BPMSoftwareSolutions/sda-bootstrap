import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ProveDomainIsolationEvidence } from "./model.js";
export declare class ProveDomainIsolationObligation implements ObligationEvaluator<ProveDomainIsolationEvidence> {
    readonly obligationId = "no-external-domain-term-or-rule-is-embedded-in-sda-mechanics";
    evaluate(evidence: ProveDomainIsolationEvidence): ObligationDisposition;
}
