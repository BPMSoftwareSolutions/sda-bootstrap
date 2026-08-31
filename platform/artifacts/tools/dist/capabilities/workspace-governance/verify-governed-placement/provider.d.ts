import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { GovernedPlacementEvidence, GovernedPlacementInput } from "./model.js";
export declare class GovernedPlacementProvider implements ResponsibilityProvider<GovernedPlacementInput, GovernedPlacementEvidence> {
    readonly responsibilityId = "evaluate-placement-and-reference-integrity";
    execute(input: GovernedPlacementInput): Promise<GovernedPlacementEvidence>;
}
