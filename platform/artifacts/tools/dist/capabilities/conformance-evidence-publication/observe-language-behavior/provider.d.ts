import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { LanguageToolchain } from "../../../ports/conformance/language-toolchain.js";
import type { ObserveLanguageBehaviorEvidence, ObserveLanguageBehaviorInput } from "./model.js";
export declare class ObserveLanguageBehaviorProvider implements ResponsibilityProvider<ObserveLanguageBehaviorInput, ObserveLanguageBehaviorEvidence> {
    private readonly toolchain;
    readonly responsibilityId = "invoke-real-language-suite-and-capture-attributable-results";
    constructor(toolchain: LanguageToolchain);
    execute(input: ObserveLanguageBehaviorInput): Promise<ObserveLanguageBehaviorEvidence>;
}
