import type { ClockPort } from "../../ports/infrastructure-ports.js";
import type { LanguageBindingDiscoveryInput } from "../../capabilities/workspace-governance/discover-language-bindings/model.js";
export declare class NodeLanguageBindingRepository {
    private readonly repositoryRoot;
    private readonly clock;
    constructor(repositoryRoot: string, clock: ClockPort);
    load(): LanguageBindingDiscoveryInput;
}
