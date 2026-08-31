import fs from "node:fs";
import path from "node:path";
import { SystemClock } from "../../adapters/clock/system-clock.js";
import { AnnotatedGherkinParser } from "../../adapters/consumer-projection/annotated-gherkin-parser.js";
import { NodeConsumerProjectionArtifactStore } from "../../adapters/consumer-projection/node-consumer-projection-artifact-store.js";
import { NodeConsumerWorkspaceRepository } from "../../adapters/consumer-projection/node-consumer-workspace-repository.js";
import { NodePlatformCapabilityRepository } from "../../adapters/consumer-projection/node-platform-capability-repository.js";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { AjvSchemaAdmission } from "../../adapters/contracts/ajv-schema-admission.cjs";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { AdmitConsumerSourceFactsObligation } from "../../capabilities/consumer-capability-compilation/admit-consumer-source-facts/obligation.js";
import { AdmitConsumerSourceFactsProvider } from "../../capabilities/consumer-capability-compilation/admit-consumer-source-facts/provider.js";
import { isAdmitConsumerSourceFactsEvidence, isAdmitConsumerSourceFactsInput } from "../../capabilities/consumer-capability-compilation/admit-consumer-source-facts/model.js";
import { ComposeCanonicalScenarioGraphObligation } from "../../capabilities/consumer-capability-compilation/compose-canonical-scenario-graph/obligation.js";
import { ComposeCanonicalScenarioGraphProvider } from "../../capabilities/consumer-capability-compilation/compose-canonical-scenario-graph/provider.js";
import { isComposeCanonicalScenarioGraphEvidence, isComposeCanonicalScenarioGraphInput } from "../../capabilities/consumer-capability-compilation/compose-canonical-scenario-graph/model.js";
import { ConstructConsumerProjectionPlanObligation } from "../../capabilities/consumer-capability-compilation/construct-consumer-projection-plan/obligation.js";
import { ConstructConsumerProjectionPlanProvider } from "../../capabilities/consumer-capability-compilation/construct-consumer-projection-plan/provider.js";
import { isConstructConsumerProjectionPlanEvidence, isConstructConsumerProjectionPlanInput } from "../../capabilities/consumer-capability-compilation/construct-consumer-projection-plan/model.js";
import { ProveProjectedSterilityBeforePublicationObligation } from "../../capabilities/consumer-capability-compilation/prove-projected-sterility-before-publication/obligation.js";
import { ProveProjectedSterilityBeforePublicationProvider } from "../../capabilities/consumer-capability-compilation/prove-projected-sterility-before-publication/provider.js";
import { isProveProjectedSterilityBeforePublicationEvidence, isProveProjectedSterilityBeforePublicationInput } from "../../capabilities/consumer-capability-compilation/prove-projected-sterility-before-publication/model.js";
import { PublishProjectedCapabilityObligation } from "../../capabilities/consumer-capability-compilation/publish-projected-capability/obligation.js";
import { PublishProjectedCapabilityProvider } from "../../capabilities/consumer-capability-compilation/publish-projected-capability/provider.js";
import { isPublishProjectedCapabilityEvidence, isPublishProjectedCapabilityInput } from "../../capabilities/consumer-capability-compilation/publish-projected-capability/model.js";
import { ResolvePlatformResponsibilitiesObligation } from "../../capabilities/consumer-capability-compilation/resolve-platform-responsibilities/obligation.js";
import { ResolvePlatformResponsibilitiesProvider } from "../../capabilities/consumer-capability-compilation/resolve-platform-responsibilities/provider.js";
import { isResolvePlatformResponsibilitiesEvidence, isResolvePlatformResponsibilitiesInput } from "../../capabilities/consumer-capability-compilation/resolve-platform-responsibilities/model.js";
import { CsharpConsumerApplicationProvider } from "../providers/csharp/consumer-application-provider.js";
import { NodeConsumerApplicationProvider } from "../providers/node/consumer-application-provider.js";
import { PythonConsumerApplicationProvider } from "../providers/python/consumer-application-provider.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
function loadScenarios(repositoryRoot) {
    const value = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "capabilities", "sda-tooling", "consumer-capability-compilation", "capability.json"), "utf8"));
    return value.scenarios;
}
function scenario(scenarios, scenarioId) {
    const found = scenarios.find((candidate) => candidate.scenarioId === scenarioId);
    if (!found)
        throw new Error(`Consumer capability compilation authority does not declare '${scenarioId}'.`);
    return found;
}
function evidence(closure, label) {
    if (!closure.evidence || closure.obligationDisposition.kind !== "SATISFIED") {
        const reasons = closure.obligationDisposition.kind === "NOT_OBSERVABLE"
            ? ` reasons=${JSON.stringify(closure.obligationDisposition.reasons)}` : "";
        throw new Error(`${label} did not close: kernel=${closure.kernelDisposition} obligation=${closure.obligationDisposition.kind}${reasons}`);
    }
    return closure.evidence;
}
function contracts() {
    return new FunctionContractAdmission(new Map([
        ["admit-consumer-source-facts-input.v1", isAdmitConsumerSourceFactsInput],
        ["consumer-source-admission-evidence.v1", isAdmitConsumerSourceFactsEvidence],
        ["compose-canonical-scenario-graph-input.v1", isComposeCanonicalScenarioGraphInput],
        ["canonical-consumer-scenario-graph-evidence.v1", isComposeCanonicalScenarioGraphEvidence],
        ["resolve-platform-responsibilities-input.v1", isResolvePlatformResponsibilitiesInput],
        ["platform-responsibility-resolution-evidence.v1", isResolvePlatformResponsibilitiesEvidence],
        ["construct-consumer-projection-plan-input.v1", isConstructConsumerProjectionPlanInput],
        ["consumer-projection-plan-evidence.v1", isConstructConsumerProjectionPlanEvidence],
        ["prove-projected-sterility-before-publication-input.v1", isProveProjectedSterilityBeforePublicationInput],
        ["prepublication-sterility-evidence.v1", isProveProjectedSterilityBeforePublicationEvidence],
        ["publish-projected-capability-input.v1", isPublishProjectedCapabilityInput],
        ["consumer-capability-publication-evidence.v1", isPublishProjectedCapabilityEvidence]
    ]));
}
export class ConsumerCapabilityCompiler {
    repositoryRoot;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
    }
    async compile(workspaceRoot, options = {}) {
        const schemaAdmission = new AjvSchemaAdmission(path.join(this.repositoryRoot, "kernel", "schemas"));
        const repository = new NodeConsumerWorkspaceRepository(this.repositoryRoot, schemaAdmission, new SystemClock());
        const facts = repository.load(workspaceRoot);
        if (options.proofProfile) {
            const validation = schemaAdmission.validate(options.proofProfile, "consumer-cross-apply-proof-profile.schema.json");
            if (!validation.valid) {
                throw new Error(`Cross-Apply proof profile failed schema admission: ${JSON.stringify(validation.errors)}`);
            }
            if (options.proofProfile.capabilityId !== facts.workspace.value.consumerId) {
                throw new Error("CROSS_APPLY_CAPABILITY_ID_DIVERGED");
            }
            if (options.proofProfile.capabilityAuthorityDigest !== facts.capabilityAuthority.digest) {
                throw new Error("CROSS_APPLY_CAPABILITY_AUTHORITY_DIGEST_DIVERGED");
            }
            const mandatoryTargets = new Set(options.proofProfile.mandatoryTargets);
            const bindingIdentities = new Set();
            for (const binding of options.proofProfile.bindings) {
                if (!mandatoryTargets.has(binding.target)) {
                    throw new Error(`CROSS_APPLY_BINDING_TARGET_NOT_MANDATORY: '${binding.target}'`);
                }
                const identity = `${binding.target}\u0000${binding.requestedCapabilityId}`;
                if (bindingIdentities.has(identity)) {
                    throw new Error(`CROSS_APPLY_BINDING_IDENTITY_DUPLICATED: '${binding.target}:${binding.requestedCapabilityId}'`);
                }
                bindingIdentities.add(identity);
            }
        }
        const targets = options.proofProfile?.mandatoryTargets ?? options.projectionTargets ?? facts.workspace.value.projectionTargets;
        if (options.proofProfile && options.projectionTargets && JSON.stringify([...options.proofProfile.mandatoryTargets].sort()) !== JSON.stringify([...options.projectionTargets].sort())) {
            throw new Error("CROSS_APPLY_TARGET_SET_DIVERGED");
        }
        if (targets.length === 0)
            throw new Error("Consumer projection requires at least one target.");
        const supported = new Set(["node", "csharp", "python"]);
        for (const target of targets) {
            if (!supported.has(target))
                throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: consumer compiler has no '${target}' target projector.`);
        }
        const observer = new InMemoryExecutionObserver();
        const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(this.repositoryRoot), contracts(), observer);
        const scenarios = loadScenarios(this.repositoryRoot);
        const rootExecutionId = options.executionId ?? `${facts.workspace.value.consumerId}-consumer-compilation`;
        const sourceClosure = await host.executeScenario({
            scenario: scenario(scenarios, "admit-consumer-source-facts"),
            input: { facts }, provider: await loadBoundProvider(this.repositoryRoot, "consumer-capability-compilation", new AdmitConsumerSourceFactsProvider()), obligation: new AdmitConsumerSourceFactsObligation(),
            executionId: `${rootExecutionId}-sources`, rootExecutionId
        });
        const sourceAdmission = evidence(sourceClosure, "Consumer source admission");
        const graphClosure = await host.executeScenario({
            scenario: scenario(scenarios, "compose-canonical-scenario-graph"),
            input: { sourceAdmission }, provider: await loadBoundProvider(this.repositoryRoot, "consumer-capability-compilation", new ComposeCanonicalScenarioGraphProvider(new AnnotatedGherkinParser())),
            obligation: new ComposeCanonicalScenarioGraphObligation(), executionId: `${rootExecutionId}-graph`, rootExecutionId
        });
        const graph = evidence(graphClosure, "Canonical consumer graph composition");
        const responsibilityClosure = await host.executeScenario({
            scenario: scenario(scenarios, "resolve-platform-responsibilities"),
            input: { sourceAdmission, graph, targets },
            provider: await loadBoundProvider(this.repositoryRoot, "consumer-capability-compilation", new ResolvePlatformResponsibilitiesProvider(new NodePlatformCapabilityRepository(this.repositoryRoot, options.proofProfile))),
            obligation: new ResolvePlatformResponsibilitiesObligation(), executionId: `${rootExecutionId}-responsibilities`, rootExecutionId
        });
        if (responsibilityClosure.evidence?.disposition === "MISSING") {
            const resolutions = responsibilityClosure.evidence?.resolutions || {};
            const missing = Object.values(resolutions)
                .flatMap((resolution) => resolution.resolutions).filter((resolution) => resolution.status === "MISSING");
            throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: ${JSON.stringify(missing)}`);
        }
        const responsibilityEvidence = evidence(responsibilityClosure, "Platform responsibility resolution");
        const planClosure = await host.executeScenario({
            scenario: scenario(scenarios, "construct-consumer-projection-plan"),
            input: {
                sourceAdmission,
                graph,
                responsibilityEvidence,
                targets,
                preserveUntargeted: options.projectionTargets !== undefined,
                ...(options.proofProfile ? { proofProfile: options.proofProfile } : {})
            },
            provider: await loadBoundProvider(this.repositoryRoot, "consumer-capability-compilation", new ConstructConsumerProjectionPlanProvider(this.repositoryRoot, [
                new NodeConsumerApplicationProvider(), new CsharpConsumerApplicationProvider(), new PythonConsumerApplicationProvider()
            ])),
            obligation: new ConstructConsumerProjectionPlanObligation(), executionId: `${rootExecutionId}-plan`, rootExecutionId
        });
        const planEvidence = evidence(planClosure, "Consumer projection planning");
        const sterilityClosure = await host.executeScenario({
            scenario: scenario(scenarios, "prove-projected-sterility-before-publication"),
            input: { plan: planEvidence.plan }, provider: await loadBoundProvider(this.repositoryRoot, "consumer-capability-compilation", new ProveProjectedSterilityBeforePublicationProvider()),
            obligation: new ProveProjectedSterilityBeforePublicationObligation(), executionId: `${rootExecutionId}-sterility`, rootExecutionId
        });
        const sterility = evidence(sterilityClosure, "Prepublication sterility proof");
        const publicationClosure = await host.executeScenario({
            scenario: scenario(scenarios, "publish-projected-capability"),
            input: { plan: planEvidence.plan, sterility, ...(options.failureInjection ? { failureInjection: options.failureInjection } : {}) },
            provider: await loadBoundProvider(this.repositoryRoot, "consumer-capability-compilation", new PublishProjectedCapabilityProvider(new NodeConsumerProjectionArtifactStore(this.repositoryRoot))),
            obligation: new PublishProjectedCapabilityObligation(), executionId: `${rootExecutionId}-publication`, rootExecutionId
        });
        if (options.failureInjection && publicationClosure.kernelDisposition === "failed") {
            throw new Error("INJECTED_PROJECTION_FAILURE: before-publish");
        }
        const publication = evidence(publicationClosure, "Consumer projection publication");
        return Object.freeze({
            scenarios: planEvidence.scenarios,
            transitions: planEvidence.transitions,
            capability: planEvidence.capability,
            query: planEvidence.query,
            queries: planEvidence.queries,
            mechanicResolution: planEvidence.mechanicResolution,
            mechanicResolutions: planEvidence.mechanicResolutions,
            expectedTelemetry: planEvidence.expectedTelemetry,
            plan: planEvidence.plan,
            outDir: publication.outputDirectory,
            closures: Object.freeze({
                sourceAdmission: sourceClosure,
                graphComposition: graphClosure,
                responsibilityResolution: responsibilityClosure,
                projectionPlan: planClosure,
                sterility: sterilityClosure,
                publication: publicationClosure
            })
        });
    }
}
