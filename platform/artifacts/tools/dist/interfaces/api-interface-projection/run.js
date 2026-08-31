import fs from "node:fs";
import path from "node:path";
import { AjvSchemaAdmission } from "../../adapters/contracts/ajv-schema-admission.cjs";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { loadApiOperationGraphFixture, loadOpenApiProjectionFixture } from "../../adapters/api-interface-projection/node-api-interface-authority-loader.js";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { isApiOperationGraphEvidence, isDeriveApiOperationGraphInput } from "../../capabilities/api-interface-projection/derive-api-operation-graph/model.js";
import { DeriveApiOperationGraphObligation } from "../../capabilities/api-interface-projection/derive-api-operation-graph/obligation.js";
import { DeriveApiOperationGraphProvider } from "../../capabilities/api-interface-projection/derive-api-operation-graph/provider.js";
import { isOpenApiProjectionEvidence, isProjectOpenApiDescriptionInput } from "../../capabilities/api-interface-projection/project-openapi-description/model.js";
import { ProjectOpenApiDescriptionObligation } from "../../capabilities/api-interface-projection/project-openapi-description/obligation.js";
import { ProjectOpenApiDescriptionProvider } from "../../capabilities/api-interface-projection/project-openapi-description/provider.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
function loadScenario(repositoryRoot, scenarioId) {
    const capability = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "capabilities", "sda-tooling", "api-interface-projection", "capability.json"), "utf8"));
    const scenario = capability.scenarios?.find((candidate) => candidate.scenarioId === scenarioId);
    if (!scenario)
        throw new Error(`Tooling capability authority does not declare '${scenarioId}'.`);
    return scenario;
}
export async function runApiOperationGraph(options) {
    const schemaAdmission = new AjvSchemaAdmission(path.join(options.repositoryRoot, "capabilities", "sda-tooling", "api-interface-projection", "contracts"));
    const unresolved = schemaAdmission.unresolvedSchemaFiles();
    if (unresolved.length > 0)
        throw new Error(`API interface schemas did not compile: ${unresolved.join(", ")}.`);
    const inputAdmission = schemaAdmission.validate(options.input, "derive-api-operation-graph-input.schema.json");
    if (!inputAdmission.valid) {
        throw new Error(`API operation graph input admission failed: ${inputAdmission.errors
            .map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
    }
    const kernelAdmission = new AjvSchemaAdmission(path.join(options.repositoryRoot, "kernel", "schemas"));
    for (const capability of options.input.capabilities) {
        const schemaFilename = capability.capabilityType === "scenario-driven-capability.v3"
            ? "capability.v3.schema.json"
            : "capability.v2.schema.json";
        const capabilityAdmission = kernelAdmission.validate(capability, schemaFilename);
        if (!capabilityAdmission.valid) {
            throw new Error(`API source capability '${capability.capabilityId}' admission failed: ${capabilityAdmission.errors
                .map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
        }
    }
    const contracts = new FunctionContractAdmission(new Map([
        ["derive-api-operation-graph-input.v1", isDeriveApiOperationGraphInput],
        ["api-operation-graph-evidence.v1", isApiOperationGraphEvidence]
    ]));
    const observer = new InMemoryExecutionObserver();
    const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(options.repositoryRoot), contracts, observer);
    const closure = await host.executeScenario({
        scenario: loadScenario(options.repositoryRoot, "derive-api-operation-graph"),
        input: options.input,
        provider: await loadBoundProvider(options.repositoryRoot, "api-interface-projection", new DeriveApiOperationGraphProvider()),
        obligation: new DeriveApiOperationGraphObligation(),
        executionId: options.executionId ?? "derive-sda-api-operation-graph"
    });
    return { closure, observations: observer.observations };
}
export async function runOpenApiProjection(options) {
    const schemaAdmission = new AjvSchemaAdmission(path.join(options.repositoryRoot, "capabilities", "sda-tooling", "api-interface-projection", "contracts"));
    const unresolved = schemaAdmission.unresolvedSchemaFiles();
    if (unresolved.length > 0)
        throw new Error(`API interface schemas did not compile: ${unresolved.join(", ")}.`);
    const inputAdmission = schemaAdmission.validate(options.input, "project-openapi-description-input.schema.json");
    if (!inputAdmission.valid) {
        throw new Error(`OpenAPI projection input admission failed: ${inputAdmission.errors
            .map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
    }
    const contracts = new FunctionContractAdmission(new Map([
        ["project-openapi-description-input.v1", isProjectOpenApiDescriptionInput],
        ["openapi-projection-evidence.v1", isOpenApiProjectionEvidence]
    ]));
    const observer = new InMemoryExecutionObserver();
    const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(options.repositoryRoot), contracts, observer);
    const closure = await host.executeScenario({
        scenario: loadScenario(options.repositoryRoot, "project-openapi-description"),
        input: options.input,
        provider: await loadBoundProvider(options.repositoryRoot, "api-interface-projection", new ProjectOpenApiDescriptionProvider()),
        obligation: new ProjectOpenApiDescriptionObligation(),
        executionId: options.executionId ?? "project-sda-openapi-description"
    });
    return { closure, observations: observer.observations };
}
export async function runConfiguredApiOperationGraph(options) {
    return runApiOperationGraph({
        repositoryRoot: options.repositoryRoot,
        input: loadApiOperationGraphFixture({
            repositoryRoot: options.repositoryRoot,
            fixtureRef: options.fixtureRef ?? "interfaces/sda-api/projection-fixture.json"
        }),
        ...(options.executionId ? { executionId: options.executionId } : {})
    });
}
export async function runConfiguredOpenApiProjection(options) {
    const configured = loadOpenApiProjectionFixture({
        repositoryRoot: options.repositoryRoot,
        fixtureRef: options.fixtureRef ?? "interfaces/sda-api/openapi-projection-fixture.json"
    });
    const operationGraphRun = await runApiOperationGraph({
        repositoryRoot: options.repositoryRoot,
        input: configured.operationGraphInput,
        executionId: `${options.executionId ?? "project-sda-openapi-description"}-graph`
    });
    if (!operationGraphRun.closure.evidence ||
        operationGraphRun.closure.obligationDisposition.kind !== "SATISFIED") {
        throw new Error("Configured OpenAPI projection cannot proceed without a satisfied admitted operation graph.");
    }
    const projectionRun = await runOpenApiProjection({
        repositoryRoot: options.repositoryRoot,
        input: {
            inputType: "sda-openapi-description-projection-input.v1",
            operationGraph: operationGraphRun.closure.evidence,
            contracts: configured.operationGraphInput.contracts,
            profile: configured.profile
        },
        ...(options.executionId ? { executionId: options.executionId } : {})
    });
    return { ...projectionRun, operationGraphRun };
}
