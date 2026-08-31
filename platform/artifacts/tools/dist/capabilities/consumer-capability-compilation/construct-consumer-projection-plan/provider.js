import { ConsumerProjectionPlanBuilder } from "../../../consumer-projection/application/consumer-projection-plan-builder.js";
export class ConstructConsumerProjectionPlanProvider {
    repositoryRoot;
    targetProviders;
    responsibilityId = "construct-complete-in-memory-consumer-file-plan";
    constructor(repositoryRoot, targetProviders) {
        this.repositoryRoot = repositoryRoot;
        this.targetProviders = targetProviders;
    }
    async execute(input) {
        return new ConsumerProjectionPlanBuilder(this.targetProviders).build({
            repositoryRoot: this.repositoryRoot,
            facts: input.sourceAdmission.facts,
            graph: input.graph,
            responsibilityEvidence: input.responsibilityEvidence,
            targets: input.targets,
            preserveUntargeted: input.preserveUntargeted,
            ...(input.proofProfile ? { proofProfile: input.proofProfile } : {})
        });
    }
}
