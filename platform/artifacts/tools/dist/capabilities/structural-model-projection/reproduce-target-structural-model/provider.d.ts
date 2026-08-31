import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ReproduceStructuralModelEvidence, ReproduceStructuralModelInput } from "./model.js";
export declare class ReproduceTargetStructuralModelProvider implements ResponsibilityProvider<ReproduceStructuralModelInput, ReproduceStructuralModelEvidence> {
    readonly responsibilityId = "render-target-structural-model-from-target-graph";
    execute(input: ReproduceStructuralModelInput): Promise<ReproduceStructuralModelEvidence>;
}
