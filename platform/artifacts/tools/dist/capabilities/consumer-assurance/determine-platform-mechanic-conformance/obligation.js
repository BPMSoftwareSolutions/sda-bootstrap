export class DeterminePlatformMechanicConformanceObligation {
    obligationId = "every-mandatory-mechanic-has-current-implementation-and-conformance-evidence";
    evaluate(evidence) {
        const active = evidence.languages.filter((language) => language.disposition !== "NOT_APPLICABLE");
        if (active.some((language) => language.disposition === "NOT_OBSERVABLE")) {
            return { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "active-language-mechanic-profiles-are-complete-and-current", reason: "one or more active language toolchains was unavailable" }] };
        }
        const satisfied = active.every((language) => language.disposition === "COMPLETE");
        return satisfied
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "active-language-mechanic-profiles-are-complete-and-current", disposition: "SATISFIED" }] }
            : { kind: "NOT_SATISFIED", conditionEvidence: [{ conditionId: "active-language-mechanic-profiles-are-complete-and-current", disposition: "NOT_SATISFIED" }] };
    }
}
