export class StageProjectedCandidateProvider {
    responsibilityId = "evaluate-isolated-candidate-staging";
    async execute(input) { return Object.freeze({ ...input }); }
}
