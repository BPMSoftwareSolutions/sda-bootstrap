import fs from "node:fs";
import path from "node:path";
import { SystemClock } from "../../adapters/clock/system-clock.js";
import { NodeConsumerAssuranceEvidenceStore } from "../../adapters/consumer-projection/node-consumer-assurance-evidence-store.js";
import { NodeConsumerAssuranceRepository } from "../../adapters/consumer-projection/node-consumer-assurance-repository.js";
import { NodeConsumerPlatformToolchains } from "../../adapters/consumer-projection/node-consumer-platform-toolchains.js";
import { NodeConsumerRuntimeToolchain, NodeInspectableQueryExecutor } from "../../adapters/consumer-projection/node-consumer-runtime-toolchain.js";
import { NodeDomainIsolationRepository } from "../../adapters/consumer-projection/node-domain-isolation-repository.js";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { DeterminePlatformMechanicConformanceObligation } from "../../capabilities/consumer-assurance/determine-platform-mechanic-conformance/obligation.js";
import { DeterminePlatformMechanicConformanceProvider } from "../../capabilities/consumer-assurance/determine-platform-mechanic-conformance/provider.js";
import { isDeterminePlatformMechanicConformanceEvidence, isDeterminePlatformMechanicConformanceInput } from "../../capabilities/consumer-assurance/determine-platform-mechanic-conformance/model.js";
import { ProveMechanicalSterilityObligation } from "../../capabilities/consumer-assurance/prove-mechanical-sterility/obligation.js";
import { ProveMechanicalSterilityProvider } from "../../capabilities/consumer-assurance/prove-mechanical-sterility/provider.js";
import { isProveMechanicalSterilityEvidence, isProveMechanicalSterilityInput } from "../../capabilities/consumer-assurance/prove-mechanical-sterility/model.js";
import { ProveDomainIsolationObligation } from "../../capabilities/consumer-assurance/prove-domain-isolation/obligation.js";
import { ProveDomainIsolationProvider } from "../../capabilities/consumer-assurance/prove-domain-isolation/provider.js";
import { isProveDomainIsolationEvidence, isProveDomainIsolationInput } from "../../capabilities/consumer-assurance/prove-domain-isolation/model.js";
import { ProveCrossTargetProjectionEquivalenceObligation } from "../../capabilities/consumer-assurance/prove-cross-target-projection-equivalence/obligation.js";
import { ProveCrossTargetProjectionEquivalenceProvider } from "../../capabilities/consumer-assurance/prove-cross-target-projection-equivalence/provider.js";
import { isProveCrossTargetProjectionEquivalenceEvidence, isProveCrossTargetProjectionEquivalenceInput } from "../../capabilities/consumer-assurance/prove-cross-target-projection-equivalence/model.js";
import { ProveQueryClosureObligation } from "../../capabilities/consumer-assurance/prove-query-closure/obligation.js";
import { ProveQueryClosureProvider } from "../../capabilities/consumer-assurance/prove-query-closure/provider.js";
import { isProveQueryClosureEvidence, isProveQueryClosureInput } from "../../capabilities/consumer-assurance/prove-query-closure/model.js";
import { ProveExperienceClosureObligation } from "../../capabilities/consumer-assurance/prove-experience-closure/obligation.js";
import { ProveExperienceClosureProvider } from "../../capabilities/consumer-assurance/prove-experience-closure/provider.js";
import { isProveExperienceClosureEvidence, isProveExperienceClosureInput } from "../../capabilities/consumer-assurance/prove-experience-closure/model.js";
import { ProveCrossApplyUiParityObligation } from "../../capabilities/consumer-assurance/prove-cross-apply-ui-parity/obligation.js";
import { ProveCrossApplyUiParityProvider } from "../../capabilities/consumer-assurance/prove-cross-apply-ui-parity/provider.js";
import { isProveCrossApplyUiParityEvidence, isProveCrossApplyUiParityInput } from "../../capabilities/consumer-assurance/prove-cross-apply-ui-parity/model.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
function planJson(compilation, relativePath) {
    const file = compilation.plan.files.find((candidate) => candidate.relativePath === relativePath);
    if (!file)
        throw new Error(`Consumer projection plan has no '${relativePath}'.`);
    return JSON.parse(file.content);
}
function fixtures(compilation) {
    const authority = planJson(compilation, "fixtures/fixtures.json");
    return Array.isArray(authority.fixtures) ? authority.fixtures : [];
}
function interfaceId(compilation) {
    const graph = compilation.query.authorityGraph;
    const authority = graph.interfaceAuthority;
    const interfaces = Array.isArray(authority.interfaces) ? authority.interfaces : [];
    const found = interfaces.find((candidate) => candidate.kind === "cli");
    if (!found || typeof found.interfaceId !== "string")
        throw new Error("Consumer assurance requires a projected CLI interface.");
    return found.interfaceId;
}
export class ConsumerAssuranceService {
    repositoryRoot;
    evidenceStore;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
        this.evidenceStore = new NodeConsumerAssuranceEvidenceStore(repositoryRoot);
    }
    async determinePlatformMechanicConformance(suppliedObservations) {
        const catalog = JSON.parse(fs.readFileSync(path.join(this.repositoryRoot, "kernel", "semantic-authority", "consumer", "sda-platform-capabilities.semantic-authority.json"), "utf8"));
        const observations = suppliedObservations ?? new NodeConsumerPlatformToolchains(this.repositoryRoot).observe(catalog);
        this.evidenceStore.writeRepository("artifacts/conformance/consumer-platform-observations.json", {
            observedAt: new SystemClock().now(), results: observations
        });
        const facts = new NodeConsumerAssuranceRepository(this.repositoryRoot).loadMechanicConformanceFacts(observations);
        const result = await this.execute("determine-platform-mechanic-conformance", facts, new DeterminePlatformMechanicConformanceProvider(), new DeterminePlatformMechanicConformanceObligation(), [["determine-platform-mechanic-conformance-input.v1", isDeterminePlatformMechanicConformanceInput],
            ["platform-mechanic-conformance-evidence.v1", isDeterminePlatformMechanicConformanceEvidence]], "typescript-platform-mechanic-conformance-provider.v1");
        const destination = result.closure.evidence
            ? this.evidenceStore.writeRepository("artifacts/conformance/consumer-platform-mechanic-resolutions.json", result.closure.evidence)
            : undefined;
        return destination ? { ...result, destination } : result;
    }
    async proveMechanicalSterility(compilation) {
        return this.execute("prove-mechanical-sterility", { plan: compilation.plan }, new ProveMechanicalSterilityProvider(), new ProveMechanicalSterilityObligation(), [["prove-mechanical-sterility-input.v1", isProveMechanicalSterilityInput], ["mechanical-sterility-evidence.v1", isProveMechanicalSterilityEvidence]], "typescript-mechanical-sterility-provider.v1");
    }
    async proveDomainIsolation() {
        return this.execute("prove-domain-isolation", { sources: new NodeDomainIsolationRepository(this.repositoryRoot, new SystemClock()).load() }, new ProveDomainIsolationProvider(), new ProveDomainIsolationObligation(), [["prove-domain-isolation-input.v1", isProveDomainIsolationInput], ["domain-isolation-evidence.v1", isProveDomainIsolationEvidence]], "typescript-domain-isolation-provider.v1");
    }
    async proveCrossTargetEquivalence(workspaceRoot, compilation, targets) {
        if (targets.length < 2)
            throw new Error("Equivalence observation requires at least two projection targets.");
        const runtime = new NodeConsumerRuntimeToolchain(this.repositoryRoot);
        for (const target of targets) {
            if (!runtime.available(target))
                throw new Error(`Consumer runtime '${target}' is NOT_OBSERVABLE.`);
            runtime.prepare(target, workspaceRoot);
        }
        const id = interfaceId(compilation);
        const executionFacts = [];
        for (const fixture of fixtures(compilation)) {
            for (const target of targets) {
                const query = compilation.queries[target];
                if (!query)
                    throw new Error(`Consumer compilation has no '${target}' query.`);
                const resolution = query.mechanicResolution;
                const origin = query.executableOrigin;
                executionFacts.push({
                    fixtureId: String(fixture.fixtureId), target,
                    result: runtime.executeFixture(target, workspaceRoot, id, String(fixture.fixtureId)),
                    mechanicResolution: String(resolution.disposition), executableOrigin: String(origin.disposition)
                });
            }
        }
        const result = await this.execute("prove-cross-target-projection-equivalence", { workspaceId: path.basename(path.resolve(workspaceRoot)), capabilityId: String(compilation.capability.capabilityId), targets, executions: executionFacts }, new ProveCrossTargetProjectionEquivalenceProvider(), new ProveCrossTargetProjectionEquivalenceObligation(), [["prove-cross-target-projection-equivalence-input.v1", isProveCrossTargetProjectionEquivalenceInput],
            ["cross-target-projection-equivalence-evidence.v1", isProveCrossTargetProjectionEquivalenceEvidence]], "typescript-cross-target-equivalence-provider.v1");
        const destination = result.closure.evidence
            ? this.evidenceStore.write(workspaceRoot, "projected/equivalence/projection-equivalence.json", result.closure.evidence)
            : undefined;
        return destination ? { ...result, destination } : result;
    }
    async proveQueryClosure(workspaceRoot, compilation, catalogReference) {
        const catalog = JSON.parse(fs.readFileSync(path.resolve(workspaceRoot, catalogReference), "utf8"));
        const runtime = new NodeConsumerRuntimeToolchain(this.repositoryRoot);
        const queryExecutor = new NodeInspectableQueryExecutor(this.repositoryRoot);
        const id = interfaceId(compilation);
        const observations = [];
        for (const fixture of fixtures(compilation)) {
            const expected = fixture.expected;
            const expectations = Array.isArray(expected.queryAssertions) ? expected.queryAssertions : [];
            if (expectations.length === 0)
                continue;
            const execution = runtime.execute("node", workspaceRoot, id, fixture.input);
            for (const expectation of expectations) {
                observations.push({
                    queryId: String(expectation.queryId),
                    fixtureId: String(fixture.fixtureId),
                    params: expectation.params,
                    result: await queryExecutor.execute(catalog, execution.outcome, String(expectation.queryId), expectation.params),
                    assertions: expectation.resultAssertions
                });
            }
        }
        const result = await this.execute("prove-query-closure", { catalog, observations }, new ProveQueryClosureProvider(), new ProveQueryClosureObligation(), [["prove-query-closure-input.v1", isProveQueryClosureInput], ["query-closure-evidence.v1", isProveQueryClosureEvidence]], "typescript-query-closure-provider.v1");
        const destination = result.closure.evidence
            ? this.evidenceStore.write(workspaceRoot, "projected/query/query-catalog-conformance.json", result.closure.evidence)
            : undefined;
        return destination ? { ...result, destination } : result;
    }
    async proveExperienceClosure(workspaceRoot, compilation) {
        const runtime = new NodeConsumerRuntimeToolchain(this.repositoryRoot);
        const id = interfaceId(compilation);
        const fixtureValues = fixtures(compilation);
        const results = Object.fromEntries(fixtureValues.map((fixture) => [
            String(fixture.fixtureId), runtime.execute("node", workspaceRoot, id, fixture.input)
        ]));
        const result = await this.execute("prove-experience-closure", { capability: compilation.capability, fixtures: fixtureValues, results }, new ProveExperienceClosureProvider(), new ProveExperienceClosureObligation(), [["prove-experience-closure-input.v1", isProveExperienceClosureInput], ["experience-closure-evidence.v1", isProveExperienceClosureEvidence]], "typescript-experience-closure-provider.v1");
        const destination = result.closure.evidence
            ? this.evidenceStore.write(workspaceRoot, "projected/experience/experience-closure.json", result.closure.evidence)
            : undefined;
        return destination ? { ...result, destination } : result;
    }
    async proveCrossApplyUiParity(workspaceRoot, input) {
        const result = await this.execute("prove-cross-apply-ui-parity", input, new ProveCrossApplyUiParityProvider(), new ProveCrossApplyUiParityObligation(), [["prove-cross-apply-ui-parity-input.v1", isProveCrossApplyUiParityInput],
            ["consumer-ui-parity-evidence.v1", isProveCrossApplyUiParityEvidence]], "typescript-cross-apply-ui-parity-provider.v1");
        const destination = result.closure.evidence
            ? this.evidenceStore.write(workspaceRoot, "projected/ui-parity/ui-parity-evidence.json", result.closure.evidence)
            : undefined;
        return destination ? { ...result, destination } : result;
    }
    async execute(scenarioId, input, provider, obligation, predicates, providerId) {
        const scenario = this.scenario(scenarioId);
        const boundProvider = await loadBoundProvider(this.repositoryRoot, "consumer-assurance", provider);
        const closure = await new ToolCapabilityHost(new NodeScenarioKernelRunner(this.repositoryRoot), new FunctionContractAdmission(new Map(predicates)), new InMemoryExecutionObserver()).executeScenario({ scenario, input, provider: boundProvider, obligation, executionId: `consumer-assurance-${scenarioId}` });
        return Object.freeze({
            capabilityId: "consumer-assurance",
            scenarioId,
            obligationId: scenario.outcome.obligation.obligationId,
            conditionIds: scenario.outcome.obligation.observableConditions.map((condition) => condition.conditionId),
            evidenceContractId: scenario.outcome.evidence.contract.contractId,
            providerId,
            closure
        });
    }
    scenario(scenarioId) {
        const capability = JSON.parse(fs.readFileSync(path.join(this.repositoryRoot, "capabilities", "sda-tooling", "consumer-assurance", "capability.json"), "utf8"));
        const found = capability.scenarios.find((candidate) => candidate.scenarioId === scenarioId);
        if (!found)
            throw new Error(`Consumer assurance authority does not declare '${scenarioId}'.`);
        return found;
    }
}
