import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ProveQueryClosureEvidence, ProveQueryClosureInput } from "./model.js";
export declare class ProveQueryClosureProvider implements ResponsibilityProvider<ProveQueryClosureInput, ProveQueryClosureEvidence> {
    readonly responsibilityId = "evaluate-declared-consumer-queries-against-observations";
    execute(input: ProveQueryClosureInput): Promise<ProveQueryClosureEvidence>;
}
