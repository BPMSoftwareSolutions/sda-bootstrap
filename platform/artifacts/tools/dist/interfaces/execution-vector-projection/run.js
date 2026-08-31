import fs from "node:fs";
import path from "node:path";
import { SystemClock } from "../../adapters/clock/system-clock.js";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { NodeProjectionRepository } from "../../adapters/projection/node-projection-repository.js";
import { NodeTargetToolchain } from "../../adapters/projection/node-target-toolchain.js";
import { TransactionalProjectionMaterializer } from "../../adapters/projection/transactional-projection-materializer.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { DeriveCanonicalExecutionGraphObligation } from "../../capabilities/execution-vector-projection/derive-canonical-execution-graph/obligation.js";
import { DeriveCanonicalExecutionGraphProvider } from "../../capabilities/execution-vector-projection/derive-canonical-execution-graph/provider.js";
import { isCanonicalExecutionGraphEvidence, isDeriveCanonicalExecutionGraphInput } from "../../capabilities/execution-vector-projection/derive-canonical-execution-graph/model.js";
import { DeriveTargetExecutionGraphObligation } from "../../capabilities/execution-vector-projection/derive-target-execution-graph/obligation.js";
import { DeriveTargetExecutionGraphProvider } from "../../capabilities/execution-vector-projection/derive-target-execution-graph/provider.js";
import { isDeriveTargetExecutionGraphInput, isTargetExecutionGraphEvidence } from "../../capabilities/execution-vector-projection/derive-target-execution-graph/model.js";
import { ReproduceTargetExecutionVectorObligation } from "../../capabilities/execution-vector-projection/reproduce-target-execution-vector/obligation.js";
import { ReproduceTargetExecutionVectorProvider } from "../../capabilities/execution-vector-projection/reproduce-target-execution-vector/provider.js";
import { isExecutionProjectionPlanEvidence, isReproduceTargetExecutionVectorInput } from "../../capabilities/execution-vector-projection/reproduce-target-execution-vector/model.js";
import { ProveProjectedExecutionBehaviorObligation } from "../../capabilities/execution-vector-projection/prove-projected-execution-behavior/obligation.js";
import { ProveProjectedExecutionBehaviorProvider } from "../../capabilities/execution-vector-projection/prove-projected-execution-behavior/provider.js";
import { isProjectedExecutionProofEvidence, isProjectedExecutionProofInput } from "../../capabilities/execution-vector-projection/prove-projected-execution-behavior/model.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
import { validateOutputIsolation } from "../../projection/proof/output-isolation.js";
function scenario(scenarios, scenarioId) {
    const found = scenarios.find((candidate) => candidate.scenarioId === scenarioId);
    if (!found)
        throw new Error(`Execution projection authority does not declare '${scenarioId}'.`);
    return found;
}
function unavailable(target, plane) {
    return { command: `${target} ${plane}`, ran: false, exitCode: null, conforming: false, reason: "required toolchain is not available" };
}
export async function runExecutionVectorProjection(options) {
    const target = options.target ?? "node";
    const authorityPath = path.join(options.repositoryRoot, "capabilities", "sda-tooling", "execution-vector-projection", "capability.json");
    const scenarios = JSON.parse(fs.readFileSync(authorityPath, "utf8")).scenarios;
    const repository = new NodeProjectionRepository(options.repositoryRoot, new SystemClock());
    const predicates = new Map([
        ["derive-canonical-execution-graph-input.v1", isDeriveCanonicalExecutionGraphInput],
        ["canonical-execution-graph-evidence.v1", isCanonicalExecutionGraphEvidence],
        ["derive-target-execution-graph-input.v1", isDeriveTargetExecutionGraphInput],
        ["target-execution-graph-evidence.v1", isTargetExecutionGraphEvidence],
        ["reproduce-target-execution-vector-input.v1", isReproduceTargetExecutionVectorInput],
        ["execution-projection-plan-evidence.v1", isExecutionProjectionPlanEvidence],
        ["prove-projected-execution-behavior-input.v1", isProjectedExecutionProofInput],
        ["projected-execution-proof-evidence.v1", isProjectedExecutionProofEvidence]
    ]);
    const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(options.repositoryRoot), new FunctionContractAdmission(predicates), new InMemoryExecutionObserver());
    const rootExecutionId = options.executionId ?? `${target}-execution-vector-projection`;
    const profile = repository.loadProfile(target);
    const canonical = await host.executeScenario({
        scenario: scenario(scenarios, "derive-canonical-execution-graph"),
        input: { vector: repository.loadExecutionVector() },
        provider: await loadBoundProvider(options.repositoryRoot, "execution-vector-projection", new DeriveCanonicalExecutionGraphProvider()),
        obligation: new DeriveCanonicalExecutionGraphObligation(),
        executionId: `${rootExecutionId}-canonical`, rootExecutionId
    });
    if (!canonical.evidence)
        throw new Error("Canonical execution graph derivation did not close.");
    const targetGraph = await host.executeScenario({
        scenario: scenario(scenarios, "derive-target-execution-graph"),
        input: { canonical: canonical.evidence, profile },
        provider: await loadBoundProvider(options.repositoryRoot, "execution-vector-projection", new DeriveTargetExecutionGraphProvider()),
        obligation: new DeriveTargetExecutionGraphObligation(),
        executionId: `${rootExecutionId}-target`, rootExecutionId
    });
    if (!targetGraph.evidence)
        throw new Error("Target execution graph derivation did not close.");
    const reproduction = await host.executeScenario({
        scenario: scenario(scenarios, "reproduce-target-execution-vector"),
        input: { targetGraph: targetGraph.evidence, profile },
        provider: await loadBoundProvider(options.repositoryRoot, "execution-vector-projection", new ReproduceTargetExecutionVectorProvider()),
        obligation: new ReproduceTargetExecutionVectorObligation(),
        executionId: `${rootExecutionId}-render`, rootExecutionId
    });
    if (!reproduction.evidence)
        throw new Error("Execution projection rendering did not close.");
    const conflicts = validateOutputIsolation(profile.value);
    if (conflicts.length > 0)
        throw new Error(`Projection outputs overlap: ${JSON.stringify(conflicts)}`);
    const toolchain = new NodeTargetToolchain(options.repositoryRoot, target);
    let compile = unavailable(target, "execution compiler");
    let behavior = unavailable(target, "execution behavior proof");
    if (toolchain.available()) {
        const transaction = new TransactionalProjectionMaterializer(options.repositoryRoot).stage(reproduction.evidence);
        try {
            transaction.activate();
            compile = toolchain.compileExecution();
            behavior = compile.conforming ? toolchain.proveExecutionBehavior() : unavailable(target, "execution behavior proof after failed compile");
            if (compile.conforming && behavior.conforming)
                transaction.commit();
            else
                transaction.rollback();
        }
        catch (error) {
            transaction.rollback();
            compile = { command: `${target} execution projection transaction`, ran: true, exitCode: 1, conforming: false, reason: error instanceof Error ? error.message : String(error) };
        }
    }
    const proof = await host.executeScenario({
        scenario: scenario(scenarios, "prove-projected-execution-behavior"),
        input: { toolchain: compile, behavior, fixtureCount: repository.fixtureCount() },
        provider: await loadBoundProvider(options.repositoryRoot, "execution-vector-projection", new ProveProjectedExecutionBehaviorProvider()),
        obligation: new ProveProjectedExecutionBehaviorObligation(),
        executionId: `${rootExecutionId}-proof`, rootExecutionId
    });
    return { canonical, targetGraph, reproduction, proof };
}
