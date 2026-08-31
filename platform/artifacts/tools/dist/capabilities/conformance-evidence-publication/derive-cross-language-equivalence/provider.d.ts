import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { CrossLanguageEquivalenceEvidence, CrossLanguageEquivalenceInput } from "./model.js";
export declare class CrossLanguageEquivalenceProvider implements ResponsibilityProvider<CrossLanguageEquivalenceInput, CrossLanguageEquivalenceEvidence> {
    readonly responsibilityId = "compare-fixture-dispositions-across-languages";
    execute(input: CrossLanguageEquivalenceInput): Promise<CrossLanguageEquivalenceEvidence>;
}
