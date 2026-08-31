import fs from "node:fs";
import path from "node:path";
import { NodeLanguageBindingRepository } from "../../adapters/workspace/node-language-binding-repository.js";
import { SystemClock } from "../../adapters/clock/system-clock.js";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { LanguageBindingDiscoveryObligation } from "../../capabilities/workspace-governance/discover-language-bindings/obligation.js";
import { LanguageBindingDiscoveryProvider } from "../../capabilities/workspace-governance/discover-language-bindings/provider.js";
import { isLanguageBindingDiscoveryEvidence, isLanguageBindingDiscoveryInput } from "../../capabilities/workspace-governance/discover-language-bindings/model.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
function loadScenario(repositoryRoot) {
    const capabilityPath = path.join(repositoryRoot, "capabilities", "sda-tooling", "workspace-governance", "capability.json");
    const capability = JSON.parse(fs.readFileSync(capabilityPath, "utf8"));
    const scenario = capability.scenarios?.find((candidate) => candidate.scenarioId === "discover-language-bindings");
    if (!scenario)
        throw new Error("Tooling capability authority does not declare discover-language-bindings.");
    return scenario;
}
export async function runLanguageBindingDiscovery(options) {
    const scenario = loadScenario(options.repositoryRoot);
    const repository = new NodeLanguageBindingRepository(options.repositoryRoot, new SystemClock());
    const input = repository.load();
    const contracts = new FunctionContractAdmission(new Map([
        ["language-binding-discovery-input.v1", isLanguageBindingDiscoveryInput],
        ["language-binding-discovery-evidence.v1", isLanguageBindingDiscoveryEvidence]
    ]));
    const observer = new InMemoryExecutionObserver();
    const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(options.repositoryRoot), contracts, observer);
    const executionId = options.executionId ?? "language-binding-discovery";
    const provider = await loadBoundProvider(options.repositoryRoot, "workspace-governance", new LanguageBindingDiscoveryProvider());
    const closure = await host.executeScenario({
        scenario,
        input,
        provider,
        obligation: new LanguageBindingDiscoveryObligation(),
        executionId
    });
    return { closure, observations: observer.observations };
}
