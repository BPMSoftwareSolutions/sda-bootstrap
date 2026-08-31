import type { JsonRecord } from "../../../consumer-projection/model/consumer-workspace-facts.js";
import type { ConsumerExperienceClosureEvidence } from "../../../consumer-projection/proof/experience-closure-observer.js";
export interface ProveExperienceClosureInput {
    readonly capability: JsonRecord;
    readonly fixtures: readonly JsonRecord[];
    readonly results: Readonly<Record<string, JsonRecord>>;
}
export type ProveExperienceClosureEvidence = ConsumerExperienceClosureEvidence;
export declare function isProveExperienceClosureInput(value: unknown): value is ProveExperienceClosureInput;
export declare function isProveExperienceClosureEvidence(value: unknown): value is ProveExperienceClosureEvidence;
