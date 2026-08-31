import fs from "node:fs";
import path from "node:path";
import { NodeAuthorityConformanceRepository } from "../../adapters/authority/node-authority-conformance-repository.js";
import { SystemClock } from "../../adapters/clock/system-clock.js";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { AuthorityConformanceObligation } from "../../capabilities/kernel-implementation-admission/determine-authority-conformance/obligation.js";
import { AuthorityConformanceProvider } from "../../capabilities/kernel-implementation-admission/determine-authority-conformance/provider.js";
import { isAuthorityConformanceEvidence, isAuthorityConformanceInput } from "../../capabilities/kernel-implementation-admission/determine-authority-conformance/model.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
function loadScenario(repositoryRoot) {
    const capabilityPath = path.join(repositoryRoot, "capabilities", "sda-tooling", "kernel-implementation-admission", "capability.json");
    const capability = JSON.parse(fs.readFileSync(capabilityPath, "utf8"));
    const scenario = capability.scenarios?.find((candidate) => candidate.scenarioId === "determine-authority-conformance");
    if (!scenario)
        throw new Error("Tooling capability authority does not declare determine-authority-conformance.");
    return scenario;
}
export async function runAuthorityConformance(options) {
    const scenario = loadScenario(options.repositoryRoot);
    const repository = new NodeAuthorityConformanceRepository(options.repositoryRoot, new SystemClock());
    const input = repository.load(options.language);
    const contracts = new FunctionContractAdmission(new Map([
        ["authority-conformance-input.v1", isAuthorityConformanceInput],
        ["authority-conformance-evidence.v1", isAuthorityConformanceEvidence]
    ]));
    const observer = new InMemoryExecutionObserver();
    const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(options.repositoryRoot), contracts, observer);
    const executionId = options.executionId ?? `authority-conformance-${options.language}`;
    const provider = await loadBoundProvider(options.repositoryRoot, "kernel-implementation-admission", new AuthorityConformanceProvider());
    const closure = await host.executeScenario({
        scenario,
        input,
        provider,
        obligation: new AuthorityConformanceObligation(),
        executionId
    });
    return { closure, observations: observer.observations };
}
