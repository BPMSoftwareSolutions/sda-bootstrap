import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import { type ApiOperationGraph } from "./model.js";
export declare class DeriveApiOperationGraphObligation implements ObligationEvaluator<ApiOperationGraph> {
    readonly obligationId = "every-operation-is-unambiguous-resolved-and-source-attributable";
    evaluate(evidence: ApiOperationGraph): ObligationDisposition;
}
