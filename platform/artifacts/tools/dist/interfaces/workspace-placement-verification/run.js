import fs from "node:fs";
import path from "node:path";
import { SystemClock } from "../../adapters/clock/system-clock.js";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { NodeWorkspaceGovernanceRepository } from "../../adapters/workspace/node-workspace-governance-repository.js";
import { isGovernedPlacementEvidence, isGovernedPlacementInput } from "../../capabilities/workspace-governance/verify-governed-placement/model.js";
import { GovernedPlacementObligation } from "../../capabilities/workspace-governance/verify-governed-placement/obligation.js";
import { GovernedPlacementProvider } from "../../capabilities/workspace-governance/verify-governed-placement/provider.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
function loadScenario(repositoryRoot) {
    const capability = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "capabilities", "sda-tooling", "workspace-governance", "capability.json"), "utf8"));
    const scenario = capability.scenarios?.find((candidate) => candidate.scenarioId === "verify-governed-placement");
    if (!scenario)
        throw new Error("Tooling capability authority does not declare verify-governed-placement.");
    return scenario;
}
export async function runWorkspacePlacementVerification(options) {
    const repository = new NodeWorkspaceGovernanceRepository(options.repositoryRoot, new SystemClock());
    const contracts = new FunctionContractAdmission(new Map([
        ["governed-placement-input.v1", isGovernedPlacementInput],
        ["governed-placement-evidence.v1", isGovernedPlacementEvidence]
    ]));
    const observer = new InMemoryExecutionObserver();
    const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(options.repositoryRoot), contracts, observer);
    const provider = await loadBoundProvider(options.repositoryRoot, "workspace-governance", new GovernedPlacementProvider());
    const closure = await host.executeScenario({
        scenario: loadScenario(options.repositoryRoot),
        input: repository.loadGovernedPlacement(),
        provider,
        obligation: new GovernedPlacementObligation(),
        executionId: options.executionId ?? "verify-governed-placement"
    });
    return { closure, observations: observer.observations };
}
