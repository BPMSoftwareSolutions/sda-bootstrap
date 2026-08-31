import fs from "node:fs";
import path from "node:path";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { ConstructDeterministicRealizationPlanObligation } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/obligation.js";
import { isConstructDeterministicRealizationPlanInput, isRealizationPlanCompilationEvidence } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
import { createReferenceRealizationPlanProvider } from "./reference-providers.js";
function loadScenario(repositoryRoot) {
    const capability = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "capabilities", "sda-tooling", "realization-planning", "capability.json"), "utf8"));
    const scenario = capability.scenarios?.find((candidate) => candidate.scenarioId === "construct-deterministic-realization-plan");
    if (!scenario) {
        throw new Error("Tooling capability authority does not declare construct-deterministic-realization-plan.");
    }
    return scenario;
}
export async function runRealizationPlanning(options) {
    const contracts = new FunctionContractAdmission(new Map([
        ["construct-deterministic-realization-plan-input.v1", isConstructDeterministicRealizationPlanInput],
        ["realization-plan-compilation-evidence.v1", isRealizationPlanCompilationEvidence]
    ]));
    const observer = new InMemoryExecutionObserver();
    const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(options.repositoryRoot), contracts, observer);
    const closure = await host.executeScenario({
        scenario: loadScenario(options.repositoryRoot),
        input: options.input,
        provider: await loadBoundProvider(options.repositoryRoot, "realization-planning", createReferenceRealizationPlanProvider()),
        obligation: new ConstructDeterministicRealizationPlanObligation(),
        executionId: options.executionId ?? `realization-plan-${options.input.request.planId}`
    });
    return { closure, observations: observer.observations };
}
