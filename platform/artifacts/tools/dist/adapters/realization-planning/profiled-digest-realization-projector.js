import { digestWithoutField } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
import { cloneFrozenProfile, digestAdapterProfile } from "../../model/realization-planning-adapter-profile.js";
import { DigestRealizationProjector } from "./digest-realization-projector.js";
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
export class ProfiledDigestRealizationProjector {
    profile;
    projector = new DigestRealizationProjector();
    constructor(profile) {
        if (!DIGEST_PATTERN.test(profile.projectionAuthorityDigest) ||
            profile.profileDigest !== digestAdapterProfile(profile)) {
            throw new Error(`Projector profile '${profile.profileId}' failed digest verification.`);
        }
        this.profile = cloneFrozenProfile(profile);
    }
    async planProjection(input) {
        if (input.projectorDigest !== this.profile.projectionAuthorityDigest) {
            throw new Error("Projection authority does not match the pinned planning snapshot.");
        }
        const reference = await this.projector.planProjection(input);
        const { projectionDigest: _referenceDigest, ...referenceWithoutDigest } = reference;
        const withoutDigest = {
            ...referenceWithoutDigest,
            projectorId: this.profile.projectorId,
            projectorProfileDigest: this.profile.profileDigest
        };
        return Object.freeze({
            ...withoutDigest,
            projectionDigest: digestWithoutField(withoutDigest, "projectionDigest")
        });
    }
}
