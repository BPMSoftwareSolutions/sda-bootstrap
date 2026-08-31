import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { LanguageDeclarationEvidence, LanguageDeclarationInput } from "./model.js";
export declare class LanguageDeclarationProvider implements ResponsibilityProvider<LanguageDeclarationInput, LanguageDeclarationEvidence> {
    readonly responsibilityId = "validate-declared-implementation-identity-and-claim";
    execute(input: any): Promise<LanguageDeclarationEvidence>;
}
