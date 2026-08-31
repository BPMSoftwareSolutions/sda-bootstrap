import type { ClockPort } from "../../ports/infrastructure-ports.js";
import type { ConformanceAuthorityRepository, LanguageImplementationFacts } from "../../ports/conformance/conformance-authority-repository.js";
import type { LanguageObligation } from "../../conformance/model/conformance-evidence-set.js";
import type { KernelSpecificationAdmissionInput } from "../../capabilities/kernel-implementation-admission/admit-kernel-specification/model.js";
import type { SchemaFamilyAdmissionInput } from "../../capabilities/kernel-implementation-admission/admit-schema-family/model.js";
import type { ExecutionVectorAdmissionInput } from "../../capabilities/kernel-implementation-admission/admit-execution-vector/model.js";
export declare class NodeConformanceAuthorityRepository implements ConformanceAuthorityRepository {
    private readonly repositoryRoot;
    private readonly clock;
    private readonly schemas;
    constructor(repositoryRoot: string, clock: ClockPort);
    discoverObligations(): readonly LanguageObligation[];
    loadKernelSpecification(): KernelSpecificationAdmissionInput;
    loadSchemaFamily(): SchemaFamilyAdmissionInput;
    loadExecutionVector(): ExecutionVectorAdmissionInput;
    loadLanguageImplementation(language: string): LanguageImplementationFacts;
    canonicalFixtures(): readonly {
        readonly fixtureId: string;
        readonly label: string;
    }[];
    private observationFact;
    private implementationOrigin;
}
