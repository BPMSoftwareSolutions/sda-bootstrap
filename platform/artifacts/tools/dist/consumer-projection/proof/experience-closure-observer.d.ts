import type { JsonRecord } from "../model/consumer-workspace-facts.js";
export interface ConsumerExperienceClosureEvidence extends JsonRecord {
    readonly closureType: "consumer-experience-closure.v1";
    readonly capabilityId: string;
    readonly experienceId: string;
    readonly promise: string;
    readonly projectionTarget: "node";
    readonly fixtures: readonly JsonRecord[];
    readonly disposition: "OBSERVABLY_TRUE" | "NOT_ESTABLISHED";
}
export declare class ExperienceClosureObserver {
    observe(input: {
        readonly capability: JsonRecord;
        readonly fixtures: readonly JsonRecord[];
        readonly results: Readonly<Record<string, JsonRecord>>;
    }): ConsumerExperienceClosureEvidence;
}
