import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { BehavioralConformanceEvidence, BehavioralConformanceInput } from "./model.js";
export declare class BehavioralConformanceProvider implements ResponsibilityProvider<BehavioralConformanceInput, BehavioralConformanceEvidence> {
    readonly responsibilityId = "evaluate-attributable-language-behavior-observation";
    execute(input: BehavioralConformanceInput): Promise<BehavioralConformanceEvidence>;
}
