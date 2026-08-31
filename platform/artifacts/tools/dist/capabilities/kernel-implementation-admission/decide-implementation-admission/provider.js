export class ImplementationAdmissionProvider {
    responsibilityId = "derive-admission-without-hiding-failed-or-unobservable-obligations";
    async execute(input) {
        const entries = [
            ["workspace-placement", "WORKSPACE GOVERNANCE", "Workspace Placement", "verify-governed-placement", "every-governed-document-is-correctly-placed-and-paired-or-has-a-finding", "workspacePlacement", input.workspacePlacement.conforming ? "PASS" : "FAIL"],
            ["kernel-specification", "CANONICAL AUTHORITY", "Kernel Specification", "admit-kernel-specification", "every-specification-requirement-is-admitted-or-identified", "kernelSpecification", input.kernelSpecification.valid ? "PASS" : "FAIL"],
            ["schema-family", "CANONICAL AUTHORITY", "Schema Family", "admit-schema-family", "every-canonical-schema-and-reference-resolves-under-the-declared-dialect", "schemaFamily", input.schemaFamily.valid ? "PASS" : "FAIL"],
            ["execution-vector", "CANONICAL AUTHORITY", "Execution Vector", "admit-execution-vector", "every-declared-step-and-ordering-constraint-is-admitted", "executionVector", input.executionVector.valid ? "PASS" : "FAIL"],
            ["binding-manifest", "LANGUAGE DECLARATION", "Binding Manifest", "admit-language-declaration", "every-required-declaration-element-has-an-explicit-disposition", "languageDeclaration", input.languageDeclaration.bindingValid ? "PASS" : "FAIL"],
            ["conformance-claim", "LANGUAGE DECLARATION", "Conformance Claim", "admit-language-declaration", "every-required-declaration-element-has-an-explicit-disposition", "languageDeclaration", input.languageDeclaration.conformanceClaimValid ? "PASS" : "FAIL"],
            ["shape-conformance", "IMPLEMENTATION PROOF", "Shape Conformance", "determine-shape-conformance", "every-canonical-object-has-an-explicit-shape-disposition", "shape", input.shape.conforming ? "PASS" : "FAIL"],
            ["execution-conformance", "IMPLEMENTATION PROOF", "Execution Conformance", "determine-execution-conformance", "every-canonical-execution-step-has-an-explicit-disposition", "execution", input.execution.conforming ? "PASS" : "FAIL"],
            ["authority-conformance", "IMPLEMENTATION PROOF", "Authority Conformance", "determine-authority-conformance", "every-authority-requirement-has-a-disposition", "authority", input.authority.conforming ? "PASS" : "FAIL"],
            ["behavioral-conformance", "IMPLEMENTATION PROOF", "Behavioral Conformance", "determine-behavioral-conformance", "every-required-fixture-has-attributable-behavior-evidence-or-an-observation-gap", "behavioral", !input.behavioral.ran ? "NOT_READY" : input.behavioral.conforming ? "PASS" : "FAIL"],
            ["execution-closure", "IMPLEMENTATION PROOF", "Execution Closure", "determine-execution-closure", "every-observed-execution-is-gap-free-or-has-a-precise-closure-finding", "executionClosure", !input.executionClosure.ran ? "NOT_READY" : input.executionClosure.conforming ? "PASS" : "FAIL"]
        ];
        const obligations = entries.map(([id, group, label, scenarioId, obligationId, evidenceKey, disposition]) => ({ id, group, label, scenarioId, obligationId, evidenceRef: input.evidenceRefs[String(evidenceKey)] ?? String(evidenceKey), disposition }));
        const blockingObligations = obligations.filter((item) => item.disposition === "FAIL").map((item) => item.id);
        const notReadyObligations = obligations.filter((item) => item.disposition === "NOT_READY").map((item) => item.id);
        return { language: input.language, implementationId: input.implementationId, evaluationDisposition: "COMPLETE", admissionDisposition: blockingObligations.length === 0 && notReadyObligations.length === 0 ? "ADMITTED" : "BLOCKED", implementationOrigin: input.implementationOrigin, obligations, blockingObligations, notReadyObligations, details: { workspacePlacement: input.workspacePlacement, kernelSpecification: input.kernelSpecification, schemaFamily: input.schemaFamily, executionVector: input.executionVector, languageDeclaration: input.languageDeclaration, shape: input.shape, execution: input.execution, authority: input.authority, behavioral: input.behavioral, executionClosure: input.executionClosure } };
    }
}
