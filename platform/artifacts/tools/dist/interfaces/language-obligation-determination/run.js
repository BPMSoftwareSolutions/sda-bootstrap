import fs from "node:fs";
import path from "node:path";
import { NodeLanguageBindingRepository } from "../../adapters/workspace/node-language-binding-repository.js";
import { SystemClock } from "../../adapters/clock/system-clock.js";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { LanguageObligationDeterminationObligation } from "../../capabilities/workspace-governance/determine-active-language-obligations/obligation.js";
import { LanguageObligationDeterminationProvider } from "../../capabilities/workspace-governance/determine-active-language-obligations/provider.js";
import { isLanguageObligationEvidence, isLanguageObligationInput } from "../../capabilities/workspace-governance/determine-active-language-obligations/model.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
function loadScenario(repositoryRoot) {
    const capabilityPath = path.join(repositoryRoot, "capabilities", "sda-tooling", "workspace-governance", "capability.json");
    const capability = JSON.parse(fs.readFileSync(capabilityPath, "utf8"));
    const scenario = capability.scenarios?.find((candidate) => candidate.scenarioId === "determine-active-language-obligations");
    if (!scenario)
        throw new Error("Tooling capability authority does not declare determine-active-language-obligations.");
    return scenario;
}
export async function runLanguageObligationDetermination(options) {
    const scenario = loadScenario(options.repositoryRoot);
    const repository = new NodeLanguageBindingRepository(options.repositoryRoot, new SystemClock());
    const input = { bindingFiles: repository.load().bindingFiles };
    const contracts = new FunctionContractAdmission(new Map([
        ["language-obligation-determination-input.v1", isLanguageObligationInput],
        ["language-obligation-determination-evidence.v1", isLanguageObligationEvidence]
    ]));
    const observer = new InMemoryExecutionObserver();
    const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(options.repositoryRoot), contracts, observer);
    const executionId = options.executionId ?? "determine-active-language-obligations";
    const provider = await loadBoundProvider(options.repositoryRoot, "workspace-governance", new LanguageObligationDeterminationProvider());
    const closure = await host.executeScenario({
        scenario,
        input,
        provider,
        obligation: new LanguageObligationDeterminationObligation(),
        executionId
    });
    return { closure, observations: observer.observations };
}
