import { type ConsumerAssertion } from "./assertion-evaluator.js";
import type { JsonRecord } from "../model/consumer-workspace-facts.js";
export interface QueryObservationFact {
    readonly queryId: string;
    readonly fixtureId: string;
    readonly params: JsonRecord;
    readonly result: unknown;
    readonly assertions: readonly ConsumerAssertion[];
}
export interface QueryClosureEvidence extends JsonRecord {
    readonly conformanceType: "consumer-query-catalog-conformance.v1";
    readonly catalogId: string;
    readonly projectionTarget: "node";
    readonly coverage: JsonRecord;
    readonly queries: readonly JsonRecord[];
    readonly disposition: "ALL_IMPLEMENTED_QUERIES_OBSERVED" | "QUERY_CATALOG_GAP";
}
export declare class QueryClosureObserver {
    observe(catalog: JsonRecord, facts: readonly QueryObservationFact[]): QueryClosureEvidence;
}
