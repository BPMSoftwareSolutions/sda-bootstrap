import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ProveMechanicalSterilityEvidence, ProveMechanicalSterilityInput } from "./model.js";
export declare class ProveMechanicalSterilityProvider implements ResponsibilityProvider<ProveMechanicalSterilityInput, ProveMechanicalSterilityEvidence> {
    readonly responsibilityId = "inspect-projected-consumer-executable-mechanics";
    execute(input: ProveMechanicalSterilityInput): Promise<ProveMechanicalSterilityEvidence>;
}
