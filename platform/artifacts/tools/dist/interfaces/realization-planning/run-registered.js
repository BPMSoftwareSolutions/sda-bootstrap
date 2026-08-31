import fs from "node:fs";
import path from "node:path";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { isRegistryBackedRealizationPlanEvidence, isRegistryBackedRealizationPlanRequest } from "../../capabilities/realization-planning/resolve-registered-realization-plan/model.js";
import { ResolveRegisteredRealizationPlanObligation } from "../../capabilities/realization-planning/resolve-registered-realization-plan/obligation.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
import { createReferenceRegisteredRealizationPlanProvider } from "./reference-providers.js";
function loadScenario(repositoryRoot) {
    const capability = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "capabilities", "sda-tooling", "realization-planning", "capability.json"), "utf8"));
    const scenario = capability.scenarios?.find((candidate) => candidate.scenarioId === "resolve-registered-realization-plan");
    if (!scenario)
        throw new Error("Tooling capability authority does not declare resolve-registered-realization-plan.");
    return scenario;
}
export async function runRegisteredRealizationPlanning(options) {
    const contracts = new FunctionContractAdmission(new Map([
        ["registry-backed-realization-plan-request.v1", isRegistryBackedRealizationPlanRequest],
        ["registry-backed-realization-plan-evidence.v1", isRegistryBackedRealizationPlanEvidence]
    ]));
    const observer = new InMemoryExecutionObserver();
    const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(options.repositoryRoot), contracts, observer);
    const closure = await host.executeScenario({
        scenario: loadScenario(options.repositoryRoot),
        input: options.request,
        provider: await loadBoundProvider(options.repositoryRoot, "realization-planning", options.provider ?? createReferenceRegisteredRealizationPlanProvider(options.registries)),
        obligation: new ResolveRegisteredRealizationPlanObligation(),
        executionId: options.executionId ?? `registered-realization-plan-${options.request.planId}`
    });
    return { closure, observations: observer.observations };
}
