import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ProveProjectedSterilityBeforePublicationEvidence, ProveProjectedSterilityBeforePublicationInput } from "./model.js";
export declare class ProveProjectedSterilityBeforePublicationProvider implements ResponsibilityProvider<ProveProjectedSterilityBeforePublicationInput, ProveProjectedSterilityBeforePublicationEvidence> {
    readonly responsibilityId = "detect-hidden-mechanics-in-planned-consumer-artifacts";
    execute(input: ProveProjectedSterilityBeforePublicationInput): Promise<ProveProjectedSterilityBeforePublicationEvidence>;
}
