import type { UiEmbodimentTarget } from "../model/ui-parity.js";
import type { UiEmbodimentProviderDiscovery } from "../../ports/ui-parity/ui-embodiment-provider.js";
interface UiProjectionFile {
    readonly relativePath: string;
    readonly content: string;
    readonly digest: string;
    readonly sourcePointers: readonly string[];
}
export interface UiProjectionEvidence {
    readonly projectionType: "consumer-ui-embodiment-projection.v1";
    readonly applicationId: string;
    readonly authorityDigest: string;
    readonly vectorCorpusDigest: string;
    readonly targets: readonly UiEmbodimentTarget[];
    readonly declaredTargets: readonly UiEmbodimentTarget[];
    readonly projectedTargets: readonly UiEmbodimentTarget[];
    readonly outputDirectory: string;
    readonly files: readonly UiProjectionFile[];
    readonly executableOrigin: "PROJECTED_ONLY";
    readonly disposition: "PROJECTED";
}
export interface UiProjectionOptions {
    readonly targets?: readonly UiEmbodimentTarget[];
}
export declare class UiParityProjector {
    private readonly repositoryRoot;
    private readonly providerDiscovery;
    constructor(repositoryRoot: string, providerDiscovery?: UiEmbodimentProviderDiscovery);
    project(workspaceRoot: string, options?: UiProjectionOptions): UiProjectionEvidence;
}
export {};
