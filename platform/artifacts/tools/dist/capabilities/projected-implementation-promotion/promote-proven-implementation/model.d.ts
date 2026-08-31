export interface PromoteProvenImplementationInput {
    readonly proofConforming: boolean;
    readonly committed: boolean;
    readonly planDigests: readonly string[];
    readonly manifestDigests: readonly string[];
}
export interface PromotionEvidence extends PromoteProvenImplementationInput {
    readonly exactManifest: boolean;
}
export declare const isPromoteProvenImplementationInput: (value: unknown) => value is PromoteProvenImplementationInput;
export declare const isPromotionEvidence: (value: unknown) => value is PromotionEvidence;
