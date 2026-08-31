import type { UiAuthorityIdentity, UiClaimantEvidence, UiExperienceCoverage, UiObjectModel, UiParityEvidence, UiVectorCorpus } from "../model/ui-parity.js";
export declare class UiParityEvaluator {
    evaluate(input: {
        readonly identity: UiAuthorityIdentity;
        readonly objectModel: UiObjectModel;
        readonly vectors: UiVectorCorpus;
        readonly coverage: UiExperienceCoverage;
        readonly claimants: readonly UiClaimantEvidence[];
    }): UiParityEvidence;
}
