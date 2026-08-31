import type { ConsumerProjectionTarget } from "../../../consumer-projection/model/consumer-workspace-facts.js";
import type { ConsumerProjectionEquivalenceEvidence, ConsumerTargetExecutionFact } from "../../../consumer-projection/proof/projection-equivalence-observer.js";
export interface ProveCrossTargetProjectionEquivalenceInput {
    readonly workspaceId: string;
    readonly capabilityId: string;
    readonly targets: readonly ConsumerProjectionTarget[];
    readonly executions: readonly ConsumerTargetExecutionFact[];
}
export type ProveCrossTargetProjectionEquivalenceEvidence = ConsumerProjectionEquivalenceEvidence;
export declare function isProveCrossTargetProjectionEquivalenceInput(value: unknown): value is ProveCrossTargetProjectionEquivalenceInput;
export declare function isProveCrossTargetProjectionEquivalenceEvidence(value: unknown): value is ProveCrossTargetProjectionEquivalenceEvidence;
