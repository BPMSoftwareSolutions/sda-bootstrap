import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ProveCrossApplyUiParityEvidence } from "./model.js";
export declare class ProveCrossApplyUiParityObligation implements ObligationEvaluator<ProveCrossApplyUiParityEvidence> {
    readonly obligationId = "every-ui-embodiment-preserves-semantic-and-presentation-experience-native-wiring-and-projected-origin";
    evaluate(evidence: ProveCrossApplyUiParityEvidence): ObligationDisposition;
}
