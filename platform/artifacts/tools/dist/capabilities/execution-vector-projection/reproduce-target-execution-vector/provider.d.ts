import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ReproduceTargetExecutionVectorEvidence, ReproduceTargetExecutionVectorInput } from "./model.js";
export declare class ReproduceTargetExecutionVectorProvider implements ResponsibilityProvider<ReproduceTargetExecutionVectorInput, ReproduceTargetExecutionVectorEvidence> {
    readonly responsibilityId = "render-target-execution-projection-plan";
    execute(input: ReproduceTargetExecutionVectorInput): Promise<ReproduceTargetExecutionVectorEvidence>;
}
