import type { LanguageObligation, ImplementationOriginEvidence } from "../../conformance/model/conformance-evidence-set.js";
import type { KernelSpecificationAdmissionInput } from "../../capabilities/kernel-implementation-admission/admit-kernel-specification/model.js";
import type { SchemaFamilyAdmissionInput } from "../../capabilities/kernel-implementation-admission/admit-schema-family/model.js";
import type { ExecutionVectorAdmissionInput } from "../../capabilities/kernel-implementation-admission/admit-execution-vector/model.js";
import type { ShapeConformanceInput } from "../../capabilities/kernel-implementation-admission/determine-shape-conformance/model.js";
import type { ExecutionConformanceInput } from "../../capabilities/kernel-implementation-admission/determine-execution-conformance/model.js";
import type { BehavioralConformanceInput } from "../../capabilities/kernel-implementation-admission/determine-behavioral-conformance/model.js";
import type { ExecutionClosureInput } from "../../capabilities/kernel-implementation-admission/determine-execution-closure/model.js";
export interface LanguageImplementationFacts {
    readonly shape: ShapeConformanceInput;
    readonly execution: ExecutionConformanceInput;
    readonly behavioral: BehavioralConformanceInput;
    readonly executionClosure: ExecutionClosureInput;
    readonly implementationOrigin: ImplementationOriginEvidence;
}
export interface ConformanceAuthorityRepository {
    discoverObligations(): readonly LanguageObligation[];
    loadKernelSpecification(): KernelSpecificationAdmissionInput;
    loadSchemaFamily(): SchemaFamilyAdmissionInput;
    loadExecutionVector(): ExecutionVectorAdmissionInput;
    loadLanguageImplementation(language: string): LanguageImplementationFacts;
    canonicalFixtures(): readonly {
        readonly fixtureId: string;
        readonly label: string;
    }[];
}
