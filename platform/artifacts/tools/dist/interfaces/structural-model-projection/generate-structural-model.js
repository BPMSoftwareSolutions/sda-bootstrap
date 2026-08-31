import { NodeProjectionRepository } from "../../adapters/projection/node-projection-repository.js";
import { SystemClock } from "../../adapters/clock/system-clock.js";
import { createSchemaLoader } from "../../projection/ir/schema-mechanics.js";
import { JsonSchemaTypeGraphBuilder } from "../../projection/ir/json-schema-type-graph-builder.js";
import { TargetProjectionGraphBuilder } from "../../projection/ir/target-projection-graph-builder.js";
import { structuralProjectionProvider } from "../../projection/providers/structural-provider-registry.js";
export function generateStructuralModel(repositoryRoot, target, profileOverrides = {}) {
    const repository = new NodeProjectionRepository(repositoryRoot, new SystemClock());
    const baseProfile = repository.loadProfile(target).value;
    const profile = { ...baseProfile, ...profileOverrides };
    const canonical = new JsonSchemaTypeGraphBuilder(createSchemaLoader(repository.loadSchemas().value)).build(profile.objects.map(({ schemaRef }) => schemaRef));
    const targetGraph = new TargetProjectionGraphBuilder(canonical, profile).build();
    const plan = structuralProjectionProvider(target, repositoryRoot).render(targetGraph, profile);
    return { canonical, targetGraph, profile, plan };
}
