import type { SourceFact } from "../../../model/semantic-model.js";
import type { JsonSchema } from "../../../projection/ir/schema-mechanics.js";
import type { CanonicalTypeGraph } from "../../../projection/model/canonical-type-graph.js";
export interface DeriveCanonicalTypeGraphInput {
    readonly schemas: SourceFact<Readonly<Record<string, JsonSchema>>>;
    readonly roots: readonly string[];
}
export type DeriveCanonicalTypeGraphEvidence = CanonicalTypeGraph;
export declare function isDeriveCanonicalTypeGraphInput(value: unknown): value is DeriveCanonicalTypeGraphInput;
export declare function isCanonicalTypeGraphEvidence(value: unknown): value is DeriveCanonicalTypeGraphEvidence;
