import { SystemClock } from "../../adapters/clock/system-clock.js";
import { NodeProjectionRepository } from "../../adapters/projection/node-projection-repository.js";
import { CanonicalExecutionGraphBuilder, TargetExecutionGraphBuilder } from "../../projection/ir/execution-graph-builder.js";
import { executionProjectionProvider } from "../../projection/providers/execution-provider-registry.js";
export function generateExecutionVector(repositoryRoot, target) {
    const repository = new NodeProjectionRepository(repositoryRoot, new SystemClock());
    const profile = repository.loadProfile(target).value;
    const vector = repository.loadExecutionVector();
    const canonical = new CanonicalExecutionGraphBuilder().build(vector.value, vector.sourceRef);
    const targetGraph = new TargetExecutionGraphBuilder().build(canonical, profile);
    const plan = executionProjectionProvider(target, repositoryRoot).render(targetGraph, profile);
    return { canonical, targetGraph, profile, plan };
}
