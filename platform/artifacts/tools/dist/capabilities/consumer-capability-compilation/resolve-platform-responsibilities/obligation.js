export class ResolvePlatformResponsibilitiesObligation {
    obligationId = "every-required-mechanic-has-one-resolution-or-a-precise-gap";
    evaluate(evidence) {
        const resolutions = Object.values(evidence.resolutions).flatMap((resolution) => resolution.resolutions);
        const missing = resolutions.filter((resolution) => resolution.status === "MISSING");
        return missing.length === 0
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "all-requested-target-mechanics-resolve-to-admitted-providers", disposition: "SATISFIED" }] }
            : { kind: "NOT_SATISFIED", conditionEvidence: [{
                        conditionId: "all-requested-target-mechanics-resolve-to-admitted-providers",
                        disposition: "NOT_SATISFIED",
                        detail: JSON.stringify(missing)
                    }] };
    }
}
