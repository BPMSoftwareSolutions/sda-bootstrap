import type { UiEmbodimentTarget } from "../../ui-parity/model/ui-parity.js";
import type { UiEmbodimentProvider, UiEmbodimentProviderDiscovery } from "../../ports/ui-parity/ui-embodiment-provider.js";
export declare class NodeUiEmbodimentProviderRegistry implements UiEmbodimentProviderDiscovery {
    private readonly providers;
    constructor(repositoryRoot: string);
    discover(target: UiEmbodimentTarget, capabilityId: string): UiEmbodimentProvider | null;
}
