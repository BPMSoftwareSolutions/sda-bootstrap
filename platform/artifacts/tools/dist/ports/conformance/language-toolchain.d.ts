import type { LanguageObligation } from "../../conformance/model/conformance-evidence-set.js";
import type { BehavioralObservation } from "../../capabilities/kernel-implementation-admission/determine-behavioral-conformance/model.js";
import type { LanguageExecutionClosureObservation } from "../../capabilities/kernel-implementation-admission/determine-execution-closure/model.js";
export interface LanguageToolchain {
    observeBehavior(obligation: LanguageObligation): BehavioralObservation;
    observeExecutionClosure(language: string): Promise<LanguageExecutionClosureObservation>;
}
