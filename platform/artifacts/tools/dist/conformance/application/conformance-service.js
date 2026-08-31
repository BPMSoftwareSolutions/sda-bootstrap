import fs from "node:fs";
import path from "node:path";
import { SystemClock } from "../../adapters/clock/system-clock.js";
import { FunctionContractAdmission } from "../../adapters/contracts/function-contract-admission.js";
import { NodeScenarioKernelRunner } from "../../adapters/node-scenario-kernel/node-scenario-kernel-runner.js";
import { InMemoryExecutionObserver } from "../../adapters/telemetry/in-memory-execution-observer.js";
import { NodeConformanceAuthorityRepository } from "../../adapters/conformance/node-conformance-authority-repository.js";
import { NodeConformanceEvidenceStore } from "../../adapters/conformance/node-conformance-evidence-store.js";
import toolchainModule from "../../adapters/conformance/language-toolchains.cjs";
import digestModule from "../../adapters/conformance/admission-input-digest.cjs";
import { runWorkspacePlacementVerification } from "../../interfaces/workspace-placement-verification/run.js";
import { runLanguageDeclarationAdmission } from "../../interfaces/language-declaration-admission/run.js";
import { runAuthorityConformance } from "../../interfaces/authority-conformance/run.js";
import { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import { loadBoundProvider } from "../../host/load-provider.js";
import { sha256 } from "../../primitives/sha256.js";
import { evidenceIsCurrent } from "../proof/evidence-freshness.js";
import { KernelSpecificationAdmissionProvider } from "../../capabilities/kernel-implementation-admission/admit-kernel-specification/provider.js";
import { KernelSpecificationAdmissionObligation } from "../../capabilities/kernel-implementation-admission/admit-kernel-specification/obligation.js";
import { isKernelSpecificationAdmissionEvidence, isKernelSpecificationAdmissionInput } from "../../capabilities/kernel-implementation-admission/admit-kernel-specification/model.js";
import { SchemaFamilyAdmissionProvider } from "../../capabilities/kernel-implementation-admission/admit-schema-family/provider.js";
import { SchemaFamilyAdmissionObligation } from "../../capabilities/kernel-implementation-admission/admit-schema-family/obligation.js";
import { isSchemaFamilyAdmissionEvidence, isSchemaFamilyAdmissionInput } from "../../capabilities/kernel-implementation-admission/admit-schema-family/model.js";
import { ExecutionVectorAdmissionProvider } from "../../capabilities/kernel-implementation-admission/admit-execution-vector/provider.js";
import { ExecutionVectorAdmissionObligation } from "../../capabilities/kernel-implementation-admission/admit-execution-vector/obligation.js";
import { isExecutionVectorAdmissionEvidence, isExecutionVectorAdmissionInput } from "../../capabilities/kernel-implementation-admission/admit-execution-vector/model.js";
import { ShapeConformanceProvider } from "../../capabilities/kernel-implementation-admission/determine-shape-conformance/provider.js";
import { ShapeConformanceObligation } from "../../capabilities/kernel-implementation-admission/determine-shape-conformance/obligation.js";
import { isShapeConformanceEvidence, isShapeConformanceInput } from "../../capabilities/kernel-implementation-admission/determine-shape-conformance/model.js";
import { ExecutionConformanceProvider } from "../../capabilities/kernel-implementation-admission/determine-execution-conformance/provider.js";
import { ExecutionConformanceObligation } from "../../capabilities/kernel-implementation-admission/determine-execution-conformance/obligation.js";
import { isExecutionConformanceEvidence, isExecutionConformanceInput } from "../../capabilities/kernel-implementation-admission/determine-execution-conformance/model.js";
import { BehavioralConformanceProvider } from "../../capabilities/kernel-implementation-admission/determine-behavioral-conformance/provider.js";
import { BehavioralConformanceObligation } from "../../capabilities/kernel-implementation-admission/determine-behavioral-conformance/obligation.js";
import { isBehavioralConformanceEvidence, isBehavioralConformanceInput } from "../../capabilities/kernel-implementation-admission/determine-behavioral-conformance/model.js";
import { ExecutionClosureProvider } from "../../capabilities/kernel-implementation-admission/determine-execution-closure/provider.js";
import { ExecutionClosureObligation } from "../../capabilities/kernel-implementation-admission/determine-execution-closure/obligation.js";
import { isExecutionClosureEvidence, isExecutionClosureInput } from "../../capabilities/kernel-implementation-admission/determine-execution-closure/model.js";
import { ImplementationAdmissionProvider } from "../../capabilities/kernel-implementation-admission/decide-implementation-admission/provider.js";
import { ImplementationAdmissionObligation } from "../../capabilities/kernel-implementation-admission/decide-implementation-admission/obligation.js";
import { isImplementationAdmissionEvidence, isImplementationAdmissionInput } from "../../capabilities/kernel-implementation-admission/decide-implementation-admission/model.js";
import { ObserveLanguageBehaviorProvider } from "../../capabilities/conformance-evidence-publication/observe-language-behavior/provider.js";
import { ObserveLanguageBehaviorObligation } from "../../capabilities/conformance-evidence-publication/observe-language-behavior/obligation.js";
import { isObserveLanguageBehaviorEvidence, isObserveLanguageBehaviorInput } from "../../capabilities/conformance-evidence-publication/observe-language-behavior/model.js";
import { PublishImplementationEvidenceProvider } from "../../capabilities/conformance-evidence-publication/publish-implementation-evidence/provider.js";
import { PublishImplementationEvidenceObligation } from "../../capabilities/conformance-evidence-publication/publish-implementation-evidence/obligation.js";
import { isPublishedImplementationEvidence, isPublishImplementationEvidenceInput } from "../../capabilities/conformance-evidence-publication/publish-implementation-evidence/model.js";
import { CrossLanguageEquivalenceProvider } from "../../capabilities/conformance-evidence-publication/derive-cross-language-equivalence/provider.js";
import { CrossLanguageEquivalenceObligation } from "../../capabilities/conformance-evidence-publication/derive-cross-language-equivalence/obligation.js";
import { isCrossLanguageEquivalenceEvidence, isCrossLanguageEquivalenceInput } from "../../capabilities/conformance-evidence-publication/derive-cross-language-equivalence/model.js";
const { NodeLanguageToolchains } = toolchainModule;
const { computeAdmissionInputDigest } = digestModule;
export class ConformanceService {
    repositoryRoot;
    clock = new SystemClock();
    repository;
    store;
    toolchains;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
        this.repository = new NodeConformanceAuthorityRepository(repositoryRoot, this.clock);
        this.store = new NodeConformanceEvidenceStore(repositoryRoot);
        this.toolchains = new NodeLanguageToolchains(repositoryRoot);
    }
    obligations() { return this.repository.discoverObligations(); }
    async observeBehavior() { const results = {}; for (const obligation of this.obligations().filter((item) => item.isActiveObligation)) {
        const closure = await this.execute("conformance-evidence-publication", "observe-language-behavior", { obligation }, new ObserveLanguageBehaviorProvider(this.toolchains), new ObserveLanguageBehaviorObligation(), [["language-behavior-observation-input.v1", isObserveLanguageBehaviorInput], ["language-behavior-observation-evidence.v1", isObserveLanguageBehaviorEvidence]], `observe-language-behavior-${obligation.language}`);
        results[obligation.language] = this.evidence(closure);
    } this.store.write("behavioral-observations.json", { observedAt: this.clock.now(), results }); return results; }
    async observeExecutionClosure() { const results = {}; for (const obligation of this.obligations().filter((item) => item.isActiveObligation))
        results[obligation.language] = await this.toolchains.observeExecutionClosure(obligation.language); this.store.write("execution-closure-observations.json", { observedAt: this.clock.now(), results }); return results; }
    async admit(language) {
        const obligation = this.obligations().find((item) => item.language === language);
        if (!obligation)
            throw new Error(`No language obligation for '${language}'.`);
        const placement = this.evidence((await runWorkspacePlacementVerification({ repositoryRoot: this.repositoryRoot, executionId: `admission-placement-${language}` })).closure);
        const declaration = this.evidence((await runLanguageDeclarationAdmission({ repositoryRoot: this.repositoryRoot, language, executionId: `admission-declaration-${language}` })).closure);
        const authority = this.evidence((await runAuthorityConformance({ repositoryRoot: this.repositoryRoot, language, executionId: `admission-authority-${language}` })).closure);
        const facts = this.repository.loadLanguageImplementation(language);
        const specification = this.evidence(await this.execute("kernel-implementation-admission", "admit-kernel-specification", this.repository.loadKernelSpecification(), new KernelSpecificationAdmissionProvider(), new KernelSpecificationAdmissionObligation(), [["kernel-specification-admission-input.v1", isKernelSpecificationAdmissionInput], ["kernel-specification-admission-evidence.v1", isKernelSpecificationAdmissionEvidence]], `admit-specification-${language}`));
        const schemaFamily = this.evidence(await this.execute("kernel-implementation-admission", "admit-schema-family", this.repository.loadSchemaFamily(), new SchemaFamilyAdmissionProvider(), new SchemaFamilyAdmissionObligation(), [["schema-family-admission-input.v1", isSchemaFamilyAdmissionInput], ["schema-family-admission-evidence.v1", isSchemaFamilyAdmissionEvidence]], `admit-schema-family-${language}`));
        const executionVector = this.evidence(await this.execute("kernel-implementation-admission", "admit-execution-vector", this.repository.loadExecutionVector(), new ExecutionVectorAdmissionProvider(), new ExecutionVectorAdmissionObligation(), [["execution-vector-admission-input.v1", isExecutionVectorAdmissionInput], ["execution-vector-admission-evidence.v1", isExecutionVectorAdmissionEvidence]], `admit-execution-vector-${language}`));
        const shape = this.evidence(await this.execute("kernel-implementation-admission", "determine-shape-conformance", facts.shape, new ShapeConformanceProvider(), new ShapeConformanceObligation(), [["shape-conformance-input.v1", isShapeConformanceInput], ["shape-conformance-evidence.v1", isShapeConformanceEvidence]], `shape-conformance-${language}`));
        const execution = this.evidence(await this.execute("kernel-implementation-admission", "determine-execution-conformance", facts.execution, new ExecutionConformanceProvider(), new ExecutionConformanceObligation(), [["execution-conformance-input.v1", isExecutionConformanceInput], ["execution-conformance-evidence.v1", isExecutionConformanceEvidence]], `execution-conformance-${language}`));
        const behavioral = this.evidence(await this.execute("kernel-implementation-admission", "determine-behavioral-conformance", facts.behavioral, new BehavioralConformanceProvider(), new BehavioralConformanceObligation(), [["behavioral-conformance-input.v1", isBehavioralConformanceInput], ["behavioral-conformance-evidence.v1", isBehavioralConformanceEvidence]], `behavioral-conformance-${language}`));
        const executionClosure = this.evidence(await this.execute("kernel-implementation-admission", "determine-execution-closure", facts.executionClosure, new ExecutionClosureProvider(), new ExecutionClosureObligation(), [["execution-closure-input.v1", isExecutionClosureInput], ["execution-closure-evidence.v1", isExecutionClosureEvidence]], `execution-closure-${language}`));
        const evidenceSet = { evidenceSetType: "conformance-evidence-set.v1", language, implementationId: obligation.binding.implementationId, evidenceRefs: { workspacePlacement: "workspace-governance/verify-governed-placement", kernelSpecification: specification.specificationPath, schemaFamily: this.repository.loadSchemaFamily().schemasDirectory, executionVector: executionVector.executionVectorPath, languageDeclaration: declaration.manifestPath, shape: facts.shape.manifestPath, execution: facts.execution.manifestPath, authority: facts.shape.manifestPath, behavioral: facts.behavioral.observationPath, executionClosure: facts.executionClosure.observationPath }, workspacePlacement: placement, kernelSpecification: specification, schemaFamily, executionVector, languageDeclaration: declaration, shape, execution, authority, behavioral, executionClosure, implementationOrigin: facts.implementationOrigin };
        return this.evidence(await this.execute("kernel-implementation-admission", "decide-implementation-admission", evidenceSet, new ImplementationAdmissionProvider(), new ImplementationAdmissionObligation(), [["implementation-admission-input.v1", isImplementationAdmissionInput], ["implementation-admission-evidence.v1", isImplementationAdmissionEvidence]], `decide-admission-${language}`));
    }
    async publish(language) { const obligation = this.obligations().find((item) => item.language === language); if (!obligation)
        throw new Error(`No language obligation for '${language}'.`); const admission = await this.admit(language); const now = this.clock.now(); const generatedAt = { sourceRef: "system-clock", digest: sha256(now), observedAt: now, value: now }; const proofInputDigest = computeAdmissionInputDigest(this.repositoryRoot, obligation); const artifact = this.evidence(await this.execute("conformance-evidence-publication", "publish-implementation-evidence", { admission, generatedAt, proofInputDigest }, new PublishImplementationEvidenceProvider(), new PublishImplementationEvidenceObligation(), [["implementation-evidence-publication-input.v1", isPublishImplementationEvidenceInput], ["published-implementation-evidence.v1", isPublishedImplementationEvidence]], `publish-evidence-${language}`)); this.store.write(`${artifact.implementationId}.conformance-result.json`, artifact); return artifact; }
    async report(requestedLanguages = []) {
        const targeted = requestedLanguages.length > 0;
        const requested = new Set(requestedLanguages);
        if (!targeted) {
            const placement = this.evidence((await runWorkspacePlacementVerification({ repositoryRoot: this.repositoryRoot })).closure);
            const specification = this.evidence(await this.execute("kernel-implementation-admission", "admit-kernel-specification", this.repository.loadKernelSpecification(), new KernelSpecificationAdmissionProvider(), new KernelSpecificationAdmissionObligation(), [["kernel-specification-admission-input.v1", isKernelSpecificationAdmissionInput], ["kernel-specification-admission-evidence.v1", isKernelSpecificationAdmissionEvidence]], "workspace-specification"));
            this.store.write("workspace.conformance-result.json", { conformanceType: "workspace-governance-result.v1", generatedAt: this.clock.now(), workspacePlacement: placement, kernelSpecification: specification });
        }
        const admissions = [];
        for (const obligation of this.obligations().filter((item) => item.isActiveObligation && (!targeted || requested.has(item.language))))
            admissions.push(await this.publish(obligation.language));
        const coherent = [];
        for (const obligation of this.obligations().filter((item) => item.isActiveObligation)) {
            const artifact = this.store.read(`${obligation.binding.implementationId}.conformance-result.json`);
            const expectedDigest = computeAdmissionInputDigest(this.repositoryRoot, obligation);
            if (artifact && evidenceIsCurrent(expectedDigest, artifact))
                coherent.push(artifact);
        }
        let crossLanguage = null;
        if (coherent.length === this.obligations().filter((item) => item.isActiveObligation).length && coherent.length >= 2) {
            crossLanguage = this.evidence(await this.execute("conformance-evidence-publication", "derive-cross-language-equivalence", { admissions: coherent, fixtures: this.repository.canonicalFixtures() }, new CrossLanguageEquivalenceProvider(), new CrossLanguageEquivalenceObligation(), [["cross-language-equivalence-input.v1", isCrossLanguageEquivalenceInput], ["cross-language-equivalence-evidence.v1", isCrossLanguageEquivalenceEvidence]], "derive-cross-language-equivalence"));
            this.store.write("cross-language.conformance-result.json", { conformanceType: "cross-language-conformance-result.v1", generatedAt: this.clock.now(), proofInputDigests: Object.fromEntries(coherent.map((artifact) => [artifact.language, artifact.proofInputDigest])), ...crossLanguage });
        }
        else
            this.store.remove("cross-language.conformance-result.json");
        return { admissions, crossLanguage };
    }
    async execute(capabilityId, scenarioId, input, provider, obligation, predicates, executionId) { const scenario = this.scenario(capabilityId, scenarioId); const contracts = new FunctionContractAdmission(new Map(predicates)); const observer = new InMemoryExecutionObserver(); const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(this.repositoryRoot), contracts, observer); const boundProvider = await loadBoundProvider(this.repositoryRoot, capabilityId, provider); return host.executeScenario({ scenario, input, provider: boundProvider, obligation, executionId }); }
    scenario(capabilityId, scenarioId) { const document = JSON.parse(fs.readFileSync(path.join(this.repositoryRoot, "capabilities", "sda-tooling", capabilityId, "capability.json"), "utf8")); const scenario = document.scenarios?.find((item) => item.scenarioId === scenarioId); if (!scenario)
        throw new Error(`Capability '${capabilityId}' does not declare '${scenarioId}'.`); return scenario; }
    evidence(closure) { if (!closure.evidence)
        throw new Error(`Scenario '${closure.scenarioId}' produced no admitted evidence (${closure.kernelDisposition}).`); return closure.evidence; }
}
