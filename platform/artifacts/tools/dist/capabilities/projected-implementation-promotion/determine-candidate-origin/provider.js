export class DetermineCandidateOriginProvider {
    responsibilityId = "derive-candidate-source-origin";
    async execute(input) {
        const projectedCount = input.plan.files.filter((file) => file.sourcePointers.length > 0).length;
        const handWrittenCount = input.plan.files.length - projectedCount;
        return { origin: projectedCount && handWrittenCount ? "MIXED" : projectedCount ? "PROJECTED" : handWrittenCount ? "HAND_AUTHORED" : "UNKNOWN", projectedCount, handWrittenCount };
    }
}
