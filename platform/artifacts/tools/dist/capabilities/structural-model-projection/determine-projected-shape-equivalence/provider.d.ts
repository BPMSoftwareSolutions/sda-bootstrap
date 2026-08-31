import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { DetermineShapeEquivalenceEvidence, DetermineShapeEquivalenceInput } from "./model.js";
export declare class DetermineProjectedShapeEquivalenceProvider implements ResponsibilityProvider<DetermineShapeEquivalenceInput, DetermineShapeEquivalenceEvidence> {
    readonly responsibilityId = "compare-projected-and-admitted-structural-shape";
    execute(input: DetermineShapeEquivalenceInput): Promise<DetermineShapeEquivalenceEvidence>;
}
