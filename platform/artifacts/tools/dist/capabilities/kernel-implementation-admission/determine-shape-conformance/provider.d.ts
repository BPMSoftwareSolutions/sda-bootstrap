import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ShapeConformanceEvidence, ShapeConformanceInput } from "./model.js";
export declare class ShapeConformanceProvider implements ResponsibilityProvider<ShapeConformanceInput, ShapeConformanceEvidence> {
    readonly responsibilityId = "compare-declared-embodiments-with-required-semantic-objects";
    execute(input: ShapeConformanceInput): Promise<ShapeConformanceEvidence>;
}
