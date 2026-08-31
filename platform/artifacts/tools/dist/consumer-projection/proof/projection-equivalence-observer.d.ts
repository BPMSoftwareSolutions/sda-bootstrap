import type { ConsumerProjectionTarget, JsonRecord } from "../model/consumer-workspace-facts.js";
export interface ConsumerTargetExecutionFact {
    readonly fixtureId: string;
    readonly target: ConsumerProjectionTarget;
    readonly result: JsonRecord;
    readonly mechanicResolution: string;
    readonly executableOrigin: string;
}
export interface ConsumerProjectionEquivalenceEvidence extends JsonRecord {
    readonly equivalenceType: "consumer-projection-equivalence.v1";
    readonly workspaceId: string;
    readonly capabilityId: string;
    readonly canonicalTarget: ConsumerProjectionTarget;
    readonly targets: readonly ConsumerProjectionTarget[];
    readonly fixtures: readonly JsonRecord[];
    readonly disposition: "BEHAVIORALLY_EQUIVALENT" | "DIVERGENT";
}
export declare function canonicalize(value: unknown): unknown;
export declare class ProjectionEquivalenceObserver {
    observe(input: {
        readonly workspaceId: string;
        readonly capabilityId: string;
        readonly targets: readonly ConsumerProjectionTarget[];
        readonly executions: readonly ConsumerTargetExecutionFact[];
    }): ConsumerProjectionEquivalenceEvidence;
}
