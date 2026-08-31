import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ProveProjectedExecutionBehaviorEvidence, ProveProjectedExecutionBehaviorInput } from "./model.js";
export declare class ProveProjectedExecutionBehaviorProvider implements ResponsibilityProvider<ProveProjectedExecutionBehaviorInput, ProveProjectedExecutionBehaviorEvidence> {
    readonly responsibilityId = "evaluate-target-toolchain-and-behavior-facts";
    execute(input: ProveProjectedExecutionBehaviorInput): Promise<ProveProjectedExecutionBehaviorEvidence>;
}
