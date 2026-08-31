import type { JsonRecord } from "../../../consumer-projection/model/consumer-workspace-facts.js";
import type { QueryClosureEvidence, QueryObservationFact } from "../../../consumer-projection/proof/query-closure-observer.js";
export interface ProveQueryClosureInput {
    readonly catalog: JsonRecord;
    readonly observations: readonly QueryObservationFact[];
}
export type ProveQueryClosureEvidence = QueryClosureEvidence;
export declare function isProveQueryClosureInput(value: unknown): value is ProveQueryClosureInput;
export declare function isProveQueryClosureEvidence(value: unknown): value is ProveQueryClosureEvidence;
