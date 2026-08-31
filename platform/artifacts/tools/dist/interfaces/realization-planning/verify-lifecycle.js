import fs from "node:fs";
import path from "node:path";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { isRealizationLifecycleContractEvidence, isRealizationLifecycleFixture } from "../../capabilities/realization-planning/verify-realization-lifecycle-contracts/model.js";
import { VerifyRealizationLifecycleContractsObligation } from "../../capabilities/realization-planning/verify-realization-lifecycle-contracts/obligation.js";
import { VerifyRealizationLifecycleContractsProvider } from "../../capabilities/realization-planning/verify-realization-lifecycle-contracts/provider.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
function loadScenario(repositoryRoot) {
    const capability = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "capabilities", "sda-tooling", "realization-planning", "capability.json"), "utf8"));
    const scenario = capability.scenarios?.find((candidate) => candidate.scenarioId === "verify-realization-lifecycle-contracts");
    if (!scenario)
        throw new Error("Tooling capability authority does not declare verify-realization-lifecycle-contracts.");
    return scenario;
}
export async function verifyRealizationLifecycle(options) {
    const contracts = new FunctionContractAdmission(new Map([
        ["realization-lifecycle-fixture.v1", isRealizationLifecycleFixture],
        ["realization-lifecycle-contract-evidence.v1", isRealizationLifecycleContractEvidence]
    ]));
    const observer = new InMemoryExecutionObserver();
    const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(options.repositoryRoot), contracts, observer);
    const closure = await host.executeScenario({
        scenario: loadScenario(options.repositoryRoot),
        input: options.fixture,
        provider: await loadBoundProvider(options.repositoryRoot, "realization-planning", new VerifyRealizationLifecycleContractsProvider()),
        obligation: new VerifyRealizationLifecycleContractsObligation(),
        executionId: options.executionId ?? `realization-lifecycle-${options.fixture.lineage.realizationId}`
    });
    return { closure, observations: observer.observations };
}
