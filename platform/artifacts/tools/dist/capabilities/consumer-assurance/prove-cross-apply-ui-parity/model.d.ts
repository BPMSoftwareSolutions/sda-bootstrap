import type { UiAuthorityIdentity, UiClaimantEvidence, UiExperienceCoverage, UiObjectModel, UiParityEvidence, UiVectorCorpus } from "../../../ui-parity/model/ui-parity.js";
export interface ProveCrossApplyUiParityInput {
    readonly identity: UiAuthorityIdentity;
    readonly objectModel: UiObjectModel;
    readonly vectors: UiVectorCorpus;
    readonly coverage: UiExperienceCoverage;
    readonly claimants: readonly UiClaimantEvidence[];
}
export type ProveCrossApplyUiParityEvidence = UiParityEvidence;
export declare function isProveCrossApplyUiParityInput(value: unknown): value is ProveCrossApplyUiParityInput;
export declare function isProveCrossApplyUiParityEvidence(value: unknown): value is ProveCrossApplyUiParityEvidence;
