import path from "node:path";
import { ConsumerAssuranceService } from "../../consumer-projection/application/consumer-assurance-service.js";
export { canonicalize } from "../../consumer-projection/proof/projection-equivalence-observer.js";
export { satisfies, valueAt } from "../../consumer-projection/proof/assertion-evaluator.js";
export { evaluateMechanicalSterility, FORBIDDEN_EXECUTABLE_MECHANICS } from "../../consumer-projection/proof/mechanical-sterility-evaluator.js";
export { DomainIsolationEvaluator, BANNED_DOMAIN_ALGORITHM_MARKERS, BANNED_DOMAIN_TERMS } from "../../consumer-projection/proof/domain-isolation-evaluator.js";
export { MechanicConformanceObserver } from "../../consumer-projection/proof/mechanic-conformance-observer.js";
export { consumerPlatformInputDigest, consumerProofIsCurrent } from "../../adapters/consumer-projection/consumer-platform-input-digest.js";
export function observeConsumerPlatformConformance(repositoryRoot, observations) {
    return new ConsumerAssuranceService(path.resolve(repositoryRoot)).determinePlatformMechanicConformance(observations);
}
export function validateNoDomainLeakage(repositoryRoot) {
    return new ConsumerAssuranceService(path.resolve(repositoryRoot)).proveDomainIsolation();
}
export function validateProjectedMechanicalSterility(repositoryRoot, compilation) {
    return new ConsumerAssuranceService(path.resolve(repositoryRoot)).proveMechanicalSterility(compilation);
}
export function observeConsumerProjectionEquivalence(repositoryRoot, workspaceRoot, compilation, targets = ["node", "csharp", "python"]) {
    return new ConsumerAssuranceService(path.resolve(repositoryRoot)).proveCrossTargetEquivalence(workspaceRoot, compilation, targets);
}
export function observeConsumerQueryCatalog(repositoryRoot, workspaceRoot, compilation, catalogReference) {
    return new ConsumerAssuranceService(path.resolve(repositoryRoot)).proveQueryClosure(workspaceRoot, compilation, catalogReference);
}
export function observeConsumerExperienceClosure(repositoryRoot, workspaceRoot, compilation) {
    return new ConsumerAssuranceService(path.resolve(repositoryRoot)).proveExperienceClosure(workspaceRoot, compilation);
}
