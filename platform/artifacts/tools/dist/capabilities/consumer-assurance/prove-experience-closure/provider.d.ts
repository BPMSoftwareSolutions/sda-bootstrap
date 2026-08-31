import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ProveExperienceClosureEvidence, ProveExperienceClosureInput } from "./model.js";
export declare class ProveExperienceClosureProvider implements ResponsibilityProvider<ProveExperienceClosureInput, ProveExperienceClosureEvidence> {
    readonly responsibilityId = "evaluate-promised-consumer-experience-conditions";
    execute(input: ProveExperienceClosureInput): Promise<ProveExperienceClosureEvidence>;
}
