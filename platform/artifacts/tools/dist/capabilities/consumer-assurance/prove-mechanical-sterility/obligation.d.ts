import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ProveMechanicalSterilityEvidence } from "./model.js";
export declare class ProveMechanicalSterilityObligation implements ObligationEvaluator<ProveMechanicalSterilityEvidence> {
    readonly obligationId = "every-projected-artifact-is-mechanical-or-has-a-precise-violation";
    evaluate(evidence: ProveMechanicalSterilityEvidence): ObligationDisposition;
}
