import type { JsonRecord } from "../../consumer-projection/model/consumer-workspace-facts.js";
export interface ConsumerSemanticReadModelAuthorityAdmissionRequest {
    readonly workspaceRoot: string;
    readonly authorityRef: string;
    readonly authorityDigest: `sha256:${string}`;
    readonly authority: JsonRecord;
    readonly recipeId: string;
}
export interface ConsumerSemanticReadModelRequest extends ConsumerSemanticReadModelAuthorityAdmissionRequest {
    readonly sources: Readonly<Record<string, unknown>>;
}
export interface ConsumerSemanticReadModelResolution {
    readonly disposition: "ADMITTED";
    readonly outputs: Readonly<Record<string, unknown>>;
    readonly evidence?: JsonRecord;
}
export interface ConsumerSemanticReadModelProvider {
    readonly providerId: string;
    readonly authorityTypes: readonly string[];
    admit(request: ConsumerSemanticReadModelAuthorityAdmissionRequest): void;
    resolve(request: ConsumerSemanticReadModelRequest): Promise<ConsumerSemanticReadModelResolution>;
}
