import fs from "node:fs";
import path from "node:path";
import { NodeProjectionRepository } from "../../adapters/projection/node-projection-repository.js";
import { SystemClock } from "../../adapters/clock/system-clock.js";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { ReproduceTargetStructuralModelObligation } from "../../capabilities/structural-model-projection/reproduce-target-structural-model/obligation.js";
import { ReproduceTargetStructuralModelProvider } from "../../capabilities/structural-model-projection/reproduce-target-structural-model/provider.js";
import { isReproduceStructuralModelEvidence, isReproduceStructuralModelInput } from "../../capabilities/structural-model-projection/reproduce-target-structural-model/model.js";
import { DetermineProjectedShapeEquivalenceObligation } from "../../capabilities/structural-model-projection/determine-projected-shape-equivalence/obligation.js";
import { DetermineProjectedShapeEquivalenceProvider } from "../../capabilities/structural-model-projection/determine-projected-shape-equivalence/provider.js";
import { isDetermineShapeEquivalenceEvidence, isDetermineShapeEquivalenceInput } from "../../capabilities/structural-model-projection/determine-projected-shape-equivalence/model.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
import { DeriveCanonicalTypeGraphProvider } from "../../capabilities/structural-model-projection/derive-canonical-type-graph/provider.js";
import { DeriveCanonicalTypeGraphObligation } from "../../capabilities/structural-model-projection/derive-canonical-type-graph/obligation.js";
import { isCanonicalTypeGraphEvidence, isDeriveCanonicalTypeGraphInput } from "../../capabilities/structural-model-projection/derive-canonical-type-graph/model.js";
import { DeriveTargetProjectionGraphProvider } from "../../capabilities/structural-model-projection/derive-target-projection-graph/provider.js";
import { DeriveTargetProjectionGraphObligation } from "../../capabilities/structural-model-projection/derive-target-projection-graph/obligation.js";
import { isDeriveTargetProjectionGraphInput, isTargetProjectionGraphEvidence } from "../../capabilities/structural-model-projection/derive-target-projection-graph/model.js";
function loadCapability(repositoryRoot) {
    const capabilityPath = path.join(repositoryRoot, "capabilities", "sda-tooling", "structural-model-projection", "capability.json");
    return JSON.parse(fs.readFileSync(capabilityPath, "utf8"));
}
function findScenario(scenarios, scenarioId) {
    const scenario = scenarios.find((candidate) => candidate.scenarioId === scenarioId);
    if (!scenario)
        throw new Error(`Tooling capability authority does not declare ${scenarioId}.`);
    return scenario;
}
function host(repositoryRoot) {
    const contracts = new FunctionContractAdmission(new Map([
        ["reproduce-structural-model-input.v1", isReproduceStructuralModelInput],
        ["structural-projection-plan-evidence.v1", isReproduceStructuralModelEvidence],
        ["determine-shape-equivalence-input.v1", isDetermineShapeEquivalenceInput],
        ["projected-shape-evidence.v1", isDetermineShapeEquivalenceEvidence],
        ["derive-canonical-type-graph-input.v1", isDeriveCanonicalTypeGraphInput],
        ["canonical-type-graph-evidence.v1", isCanonicalTypeGraphEvidence],
        ["derive-target-projection-graph-input.v1", isDeriveTargetProjectionGraphInput],
        ["target-projection-graph-evidence.v1", isTargetProjectionGraphEvidence]
    ]));
    const observer = new InMemoryExecutionObserver();
    return {
        host: new ToolCapabilityHost(new NodeScenarioKernelRunner(repositoryRoot), contracts, observer),
        observer
    };
}
export async function runStructuralModelProjection(options) {
    const scenarios = loadCapability(options.repositoryRoot).scenarios;
    const repository = new NodeProjectionRepository(options.repositoryRoot, new SystemClock());
    const { host: capabilityHost } = host(options.repositoryRoot);
    const target = options.target ?? "node";
    const profile = repository.loadProfile(target);
    const rootExecutionId = options.executionId ?? `${target}-structural-model-projection`;
    const canonical = await capabilityHost.executeScenario({
        scenario: findScenario(scenarios, "derive-canonical-type-graph"),
        input: { schemas: repository.loadSchemas(), roots: profile.value.objects.map(({ schemaRef }) => schemaRef) },
        provider: await loadBoundProvider(options.repositoryRoot, "structural-model-projection", new DeriveCanonicalTypeGraphProvider()),
        obligation: new DeriveCanonicalTypeGraphObligation(),
        executionId: `${rootExecutionId}-canonical`,
        rootExecutionId
    });
    const targetGraph = await capabilityHost.executeScenario({
        scenario: findScenario(scenarios, "derive-target-projection-graph"),
        input: { canonical: canonical.evidence ?? { roots: [], definitions: [] }, profile },
        provider: await loadBoundProvider(options.repositoryRoot, "structural-model-projection", new DeriveTargetProjectionGraphProvider()),
        obligation: new DeriveTargetProjectionGraphObligation(),
        executionId: `${rootExecutionId}-target`,
        rootExecutionId
    });
    const reproductionExecutionId = `${rootExecutionId}-render`;
    const reproduction = await capabilityHost.executeScenario({
        scenario: findScenario(scenarios, "reproduce-target-structural-model"),
        input: {
            targetGraph: targetGraph.evidence ?? { graphType: "target-projection-graph.v1", target, definitions: [] },
            profile
        },
        provider: await loadBoundProvider(options.repositoryRoot, "structural-model-projection", new ReproduceTargetStructuralModelProvider()),
        obligation: new ReproduceTargetStructuralModelObligation(),
        executionId: reproductionExecutionId
    });
    const equivalenceExecutionId = `${reproductionExecutionId}-equivalence`;
    const equivalence = await capabilityHost.executeScenario({
        scenario: findScenario(scenarios, "determine-projected-shape-equivalence"),
        input: {
            plan: reproduction.evidence ?? { outputDirectory: "", files: [] },
            admittedSource: repository.loadAdmittedSource(target)
        },
        provider: await loadBoundProvider(options.repositoryRoot, "structural-model-projection", new DetermineProjectedShapeEquivalenceProvider()),
        obligation: new DetermineProjectedShapeEquivalenceObligation(),
        executionId: equivalenceExecutionId,
        rootExecutionId: reproductionExecutionId
    });
    return { canonical, targetGraph, reproduction, equivalence };
}
