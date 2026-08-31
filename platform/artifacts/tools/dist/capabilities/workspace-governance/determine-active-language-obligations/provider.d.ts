import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { LanguageObligationEvidence, LanguageObligationInput } from "./model.js";
export declare class LanguageObligationDeterminationProvider implements ResponsibilityProvider<LanguageObligationInput, LanguageObligationEvidence> {
    readonly responsibilityId = "classify-binding-as-active-or-informational";
    execute(input: LanguageObligationInput): Promise<LanguageObligationEvidence>;
}
