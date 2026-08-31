import { sha256 } from "../../primitives/sha256.js";
import { ConsumerQueryProjector } from "../providers/common/consumer-query-projector.js";
import { ExpectedTelemetryProjector } from "../providers/common/expected-telemetry-projector.js";
import { ConsumerExecutionEmbodimentCompiler } from "./consumer-execution-embodiment-compiler.js";
function json(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}
function file(relativePath, content, sourcePointers, target = "shared") {
    return Object.freeze({ relativePath, content, digest: sha256(content), sourcePointers, target });
}
export class ConsumerProjectionPlanBuilder {
    providers;
    constructor(providers) {
        this.providers = new Map(providers.map((provider) => [provider.target, provider]));
    }
    build(options) {
        const { facts, graph, responsibilityEvidence, targets } = options;
        const primaryTarget = targets[0];
        if (!primaryTarget)
            throw new Error("Consumer projection requires at least one target.");
        const expectedTelemetry = new ExpectedTelemetryProjector().project(facts.telemetryAuthority.value, facts.executionVector.value, graph.capability);
        const activeCatalog = {
            ...facts.platformCapabilityCatalog.value,
            capabilities: facts.platformCapabilityCatalog.value.capabilities.filter((capability) => targets.includes(capability.projectionTarget))
        };
        const queries = {};
        for (const target of targets) {
            const mechanicResolution = responsibilityEvidence.resolutions[target];
            if (!mechanicResolution)
                throw new Error(`No platform-responsibility resolution exists for '${target}'.`);
            queries[target] = new ConsumerQueryProjector().project({
                queryAuthority: facts.queryAuthority.value,
                capability: graph.capability,
                executionAuthorities: facts.executionAuthorities.value,
                projectionAuthorities: facts.projectionAuthorities.value,
                interfaceAuthority: facts.resolvedInterfaceAuthority,
                contractAuthorities: facts.contractAuthorities,
                platformCapabilityCatalog: activeCatalog,
                mechanicResolution,
                expectedTelemetry,
                executableOrigin: facts.executableOrigin,
                projectionTarget: target,
                inspectableQueryCatalog: facts.inspectableQueryCatalog?.value ?? null
            });
        }
        const query = queries[primaryTarget];
        const primaryResolution = responsibilityEvidence.resolutions[primaryTarget];
        if (!query || !primaryResolution)
            throw new Error(`Primary consumer projection target '${primaryTarget}' is incomplete.`);
        // A capability that declares selection groups or bounded recurrence has
        // topology the linear v1/v2 plan cannot represent: that plan carries one
        // transition per node, so a branch would have to be silently dropped. Such a
        // capability is graph-native and emits plan v3 only rather than a fabricated
        // linear plan. This is the per-capability cutover boundary.
        const graphNativeTopology = graph.capability.executionTopologyAuthority === "graph-v3" ||
            (graph.capability.edgeGroups?.length ?? 0) > 0 ||
            (graph.capability.recurrenceAuthorities?.length ?? 0) > 0;
        const executionPlans = {};
        if (targets.includes("node") && !graphNativeTopology) {
            executionPlans.node = new ConsumerExecutionEmbodimentCompiler().compile(queries.node, "node", graph.capability);
        }
        // Shadow evidence: the canonical graph and plan v3 are emitted as sidecars so
        // existing v1/v2 receipts stay byte-identical until per-capability cutover.
        const graphPlans = {};
        for (const target of targets) {
            graphPlans[target] = new ConsumerExecutionEmbodimentCompiler()
                .compileV3(queries[target], target, graph.capability);
        }
        const sourcePointers = [
            facts.feature.sourceRef,
            facts.capabilityAuthority.sourceRef,
            facts.semanticGraph.sourceRef,
            facts.executionAuthorities.sourceRef,
            facts.projectionAuthorities.sourceRef,
            facts.interfaceAuthority.sourceRef,
            facts.fixtures.sourceRef,
            facts.queryAuthority.sourceRef,
            facts.telemetryAuthority.sourceRef,
            ...facts.uiAuthorities.map((authority) => authority.fact.sourceRef),
            ...(facts.inspectableQueryCatalog ? [facts.inspectableQueryCatalog.sourceRef] : [])
        ];
        const files = [];
        for (const scenario of graph.scenarios)
            files.push(file(`scenarios/${scenario.scenarioId}.json`, json(scenario), [facts.feature.sourceRef]));
        for (const transition of graph.transitions)
            files.push(file(`transitions/${transition.transitionId}.json`, json(transition), [facts.semanticGraph.sourceRef]));
        const primaryExecutionPlan = executionPlans[primaryTarget];
        const primaryExecutionPlanContent = primaryExecutionPlan ? json(primaryExecutionPlan) : null;
        files.push(file("capability.json", json(graph.capability), [facts.capabilityAuthority.sourceRef, facts.feature.sourceRef, facts.semanticGraph.sourceRef]), file("query/conformance-query.json", json(query), sourcePointers), file("query/platform-mechanic-resolution.json", json(primaryResolution), [facts.platformCapabilityCatalog.sourceRef]), file("telemetry/expected-trace.json", json(expectedTelemetry), [facts.telemetryAuthority.sourceRef, facts.executionVector.sourceRef]), file("fixtures/fixtures.json", json(facts.fixtures.value), [facts.fixtures.sourceRef]), ...(primaryExecutionPlan && primaryExecutionPlanContent ? [
            file(`execution-plans/consumer-execution-plan.${primaryTarget}.json`, primaryExecutionPlanContent, sourcePointers, primaryTarget),
            file("application-binding.json", json({
                bindingType: "projected-consumer-application-binding.v2",
                executionPlan: `execution-plans/consumer-execution-plan.${primaryTarget}.json`,
                executionPlanDigest: sha256(primaryExecutionPlanContent),
                fixtures: "fixtures/fixtures.json",
                mechanicalSterility: "projection-conformance.json"
            }), [facts.interfaceAuthority.sourceRef], primaryTarget)
        ] : graphNativeTopology && graphPlans[primaryTarget] ? [
            file("application-binding.json", json({
                bindingType: "projected-consumer-application-binding.v3",
                executionPlan: `execution-plans/consumer-execution-plan.${primaryTarget}.v3.json`,
                executionPlanDigest: sha256(json(graphPlans[primaryTarget])),
                fixtures: "fixtures/fixtures.json",
                mechanicalSterility: "projection-conformance.json"
            }), [facts.interfaceAuthority.sourceRef], primaryTarget)
        ] : [
            file("application-binding.json", json({
                bindingType: "projected-consumer-application-binding.v1",
                capability: "capability.json",
                query: "query/conformance-query.json",
                fixtures: "fixtures/fixtures.json",
                mechanicalSterility: "projection-conformance.json"
            }), [facts.interfaceAuthority.sourceRef])
        ]));
        for (const target of targets) {
            const targetQuery = queries[target];
            const targetResolution = responsibilityEvidence.resolutions[target];
            if (!targetQuery || !targetResolution)
                throw new Error(`Consumer target '${target}' has no complete plan inputs.`);
            const targetExecutionPlan = executionPlans[target];
            const targetExecutionPlanContent = targetExecutionPlan ? json(targetExecutionPlan) : null;
            if (targetExecutionPlan && targetExecutionPlanContent && target !== primaryTarget) {
                files.push(file(`execution-plans/consumer-execution-plan.${target}.json`, targetExecutionPlanContent, sourcePointers, target));
            }
            const graphPlan = graphPlans[target];
            if (graphPlan) {
                files.push(file(`execution-plans/consumer-execution-plan.${target}.v3.json`, json(graphPlan), sourcePointers, target));
            }
            files.push(file(`query/conformance-query.${target}.json`, json(targetQuery), sourcePointers, target), file(`query/platform-mechanic-resolution.${target}.json`, json(targetResolution), [facts.platformCapabilityCatalog.sourceRef], target), file(`application-binding.${target}.json`, json(targetExecutionPlan && targetExecutionPlanContent ? {
                bindingType: "projected-consumer-application-binding.v2",
                executionPlan: `execution-plans/consumer-execution-plan.${target}.json`,
                executionPlanDigest: sha256(targetExecutionPlanContent),
                fixtures: "fixtures/fixtures.json",
                mechanicalSterility: "projection-conformance.json"
            } : graphNativeTopology && graphPlan ? {
                bindingType: "projected-consumer-application-binding.v3",
                executionPlan: `execution-plans/consumer-execution-plan.${target}.v3.json`,
                executionPlanDigest: sha256(json(graphPlan)),
                fixtures: "fixtures/fixtures.json",
                mechanicalSterility: "projection-conformance.json"
            } : {
                bindingType: "projected-consumer-application-binding.v1",
                capability: "capability.json",
                query: `query/conformance-query.${target}.json`,
                fixtures: "fixtures/fixtures.json",
                mechanicalSterility: "projection-conformance.json"
            }), [facts.interfaceAuthority.sourceRef], target));
            const provider = this.providers.get(target);
            if (!provider)
                throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: consumer compiler has no '${target}' target projector.`);
            files.push(...provider.render({
                repositoryRoot: options.repositoryRoot,
                workspaceRoot: facts.workspaceRoot,
                capabilityId: graph.capability.capabilityId,
                interfaceAuthority: facts.resolvedInterfaceAuthority,
                query: targetQuery
            }));
        }
        files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
        const plan = Object.freeze({
            planType: "consumer-projection-plan.v1",
            workspaceRoot: facts.workspaceRoot,
            outputDirectory: "projected",
            targets: Object.freeze([...targets]),
            preserveUntargeted: options.preserveUntargeted,
            ...(options.proofProfile ? { proofProfile: Object.freeze({ ...options.proofProfile }) } : {}),
            authorityRefs: Object.freeze([
                facts.declaration.feature,
                facts.declaration.capability,
                facts.declaration.semanticGraph,
                facts.declaration.executionAuthorities,
                facts.declaration.projectionAuthorities,
                facts.declaration.interfaces,
                facts.declaration.fixtures,
                facts.workspace.value.conformanceQuery,
                facts.workspace.value.telemetryAuthority,
                ...facts.uiAuthorities.map((authority) => authority.authorityRef),
                ...(facts.workspace.value.queryCatalog ? [facts.workspace.value.queryCatalog] : [])
            ]),
            admittedPlatformCapabilityIds: Object.freeze(activeCatalog.capabilities.map((capability) => capability.capabilityId).sort()),
            files: Object.freeze(files)
        });
        return Object.freeze({
            evidenceType: "consumer-projection-plan-evidence.v1",
            plan,
            scenarios: graph.scenarios,
            transitions: graph.transitions,
            capability: graph.capability,
            query,
            queries,
            mechanicResolution: primaryResolution,
            mechanicResolutions: responsibilityEvidence.resolutions,
            expectedTelemetry,
            executionPlans: Object.freeze({ ...executionPlans })
        });
    }
}
