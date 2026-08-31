import type { LanguageObligation } from "../../../conformance/model/conformance-evidence-set.js";
import type { BehavioralObservation } from "../../kernel-implementation-admission/determine-behavioral-conformance/model.js";
import { isBehavioralConformanceEvidence } from "../../kernel-implementation-admission/determine-behavioral-conformance/model.js";
export interface ObserveLanguageBehaviorInput {
    readonly obligation: LanguageObligation;
}
export type ObserveLanguageBehaviorEvidence = BehavioralObservation;
export declare const isObserveLanguageBehaviorInput: (value: unknown) => value is ObserveLanguageBehaviorInput;
export declare const isObserveLanguageBehaviorEvidence: typeof isBehavioralConformanceEvidence;
