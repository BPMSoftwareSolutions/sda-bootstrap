import fs from "node:fs";
import path from "node:path";
import { SystemClock } from "../../adapters/clock/system-clock.js";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { NodeWorkspaceGovernanceRepository } from "../../adapters/workspace/node-workspace-governance-repository.js";
import { isLanguageDeclarationEvidence, isLanguageDeclarationInput } from "../../capabilities/workspace-governance/admit-language-declaration/model.js";
import { LanguageDeclarationObligation } from "../../capabilities/workspace-governance/admit-language-declaration/obligation.js";
import { LanguageDeclarationProvider } from "../../capabilities/workspace-governance/admit-language-declaration/provider.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
function loadScenario(repositoryRoot) {
    const capability = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "capabilities", "sda-tooling", "workspace-governance", "capability.json"), "utf8"));
    const scenario = capability.scenarios?.find((candidate) => candidate.scenarioId === "admit-language-declaration");
    if (!scenario)
        throw new Error("Tooling capability authority does not declare admit-language-declaration.");
    return scenario;
}
export async function runLanguageDeclarationAdmission(options) {
    const repository = new NodeWorkspaceGovernanceRepository(options.repositoryRoot, new SystemClock());
    const contracts = new FunctionContractAdmission(new Map([
        ["language-declaration-admission-input.v1", isLanguageDeclarationInput],
        ["language-declaration-evidence.v1", isLanguageDeclarationEvidence]
    ]));
    const observer = new InMemoryExecutionObserver();
    const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(options.repositoryRoot), contracts, observer);
    const provider = await loadBoundProvider(options.repositoryRoot, "workspace-governance", new LanguageDeclarationProvider());
    const closure = await host.executeScenario({
        scenario: loadScenario(options.repositoryRoot),
        input: repository.loadLanguageDeclaration(options.language),
        provider,
        obligation: new LanguageDeclarationObligation(),
        executionId: options.executionId ?? `admit-language-declaration-${options.language}`
    });
    return { closure, observations: observer.observations };
}
