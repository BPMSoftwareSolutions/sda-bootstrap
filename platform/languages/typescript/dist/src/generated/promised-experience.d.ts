import type { PromisedExperienceObservableCondition } from "./promised-experience-observable-condition.js";
export declare const EXPERIENCE_TYPE: "promised-experience.v1";
export interface PromisedExperience {
    experienceId: string;
    actor: string;
    promise: string;
    observableConditions: PromisedExperienceObservableCondition[];
}
