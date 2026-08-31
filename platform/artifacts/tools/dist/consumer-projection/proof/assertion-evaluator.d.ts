import type { JsonRecord } from "../model/consumer-workspace-facts.js";
export interface ConsumerAssertion extends JsonRecord {
    readonly path: string;
    readonly operator: "equals" | "contains" | "not-contains";
    readonly value: unknown;
}
export declare function valueAt(source: unknown, dottedPath: string): unknown;
export declare function satisfies(actual: unknown, assertion: Pick<ConsumerAssertion, "operator" | "value">): boolean;
