import type { JsonRecord } from "../../consumer-projection/model/consumer-workspace-facts.js";
import type { UiEmbodimentTarget, UiObjectModel } from "../../ui-parity/model/ui-parity.js";
import type { UiPresentationCompilation } from "../../ui-parity/application/ui-presentation-compiler.js";
export interface UiEmbodimentProjectionDraft {
    readonly relativePath: string;
    readonly content: string;
    readonly sourcePointers: readonly string[];
}
export interface UiEmbodimentMaterializationRequest {
    readonly target: UiEmbodimentTarget;
    readonly capabilityId: string;
    readonly authority: JsonRecord;
    readonly authorityRef: string;
    readonly authorityContent: string;
    readonly identity: JsonRecord;
    readonly identityContent: string;
    readonly vectorRef: string;
    readonly vectorContent: string;
    readonly coverageRef: string;
    readonly coverageContent: string;
    readonly objectModelRef: string;
    readonly objectModel: UiObjectModel;
    readonly objectModelContent: string;
    readonly compilation: UiPresentationCompilation;
}
export interface UiEmbodimentProvider {
    readonly providerId: string;
    readonly embodimentTarget: UiEmbodimentTarget;
    readonly capabilityId: string;
    readonly implementationRef: string;
    materialize(request: UiEmbodimentMaterializationRequest): readonly UiEmbodimentProjectionDraft[];
}
export interface UiEmbodimentProviderDiscovery {
    discover(target: UiEmbodimentTarget, capabilityId: string): UiEmbodimentProvider | null;
}
