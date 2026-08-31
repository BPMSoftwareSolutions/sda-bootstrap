import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { LanguageBindingDiscoveryEvidence, LanguageBindingDiscoveryInput } from "./model.js";
export declare class LanguageBindingDiscoveryProvider implements ResponsibilityProvider<LanguageBindingDiscoveryInput, LanguageBindingDiscoveryEvidence> {
    readonly responsibilityId = "enumerate-declared-binding-manifests";
    execute(input: LanguageBindingDiscoveryInput): Promise<LanguageBindingDiscoveryEvidence>;
}
