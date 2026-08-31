import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ProveDomainIsolationEvidence, ProveDomainIsolationInput } from "./model.js";
export declare class ProveDomainIsolationProvider implements ResponsibilityProvider<ProveDomainIsolationInput, ProveDomainIsolationEvidence> {
    readonly responsibilityId = "detect-consumer-domain-vocabulary-in-platform-tooling";
    execute(input: ProveDomainIsolationInput): Promise<ProveDomainIsolationEvidence>;
}
