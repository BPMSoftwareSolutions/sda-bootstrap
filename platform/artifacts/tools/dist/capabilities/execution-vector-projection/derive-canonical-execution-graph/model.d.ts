import type { SourceFact } from "../../../model/semantic-model.js";
import type { CanonicalExecutionGraph } from "../../../projection/model/canonical-execution-graph.js";
export interface DeriveCanonicalExecutionGraphInput {
    readonly vector: SourceFact<unknown>;
}
export type DeriveCanonicalExecutionGraphEvidence = CanonicalExecutionGraph;
export declare function isDeriveCanonicalExecutionGraphInput(value: unknown): value is DeriveCanonicalExecutionGraphInput;
export declare function isCanonicalExecutionGraphEvidence(value: unknown): value is CanonicalExecutionGraph;
