import type { ConsumerPlatformObservation } from "../../consumer-projection/model/platform-mechanic-conformance.js";
import type { PlatformCapabilityCatalog } from "../../consumer-projection/model/consumer-workspace-facts.js";
export declare class NodeConsumerPlatformToolchains {
    private readonly repositoryRoot;
    constructor(repositoryRoot: string);
    observe(catalog: PlatformCapabilityCatalog): Readonly<Record<string, ConsumerPlatformObservation>>;
    private runNode;
    private runPython;
}
