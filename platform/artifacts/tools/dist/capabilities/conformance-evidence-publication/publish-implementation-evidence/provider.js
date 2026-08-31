export class PublishImplementationEvidenceProvider {
    responsibilityId = "construct-versioned-implementation-evidence-artifact";
    async execute(input) { return { conformanceType: "scenario-kernel-admission-result.v1", implementationId: input.admission.implementationId, language: input.admission.language, generatedAt: input.generatedAt.value, proofInputDigest: input.proofInputDigest, evaluationDisposition: input.admission.evaluationDisposition, admissionDisposition: input.admission.admissionDisposition, implementationOrigin: input.admission.implementationOrigin, obligations: input.admission.obligations, blockingObligations: input.admission.blockingObligations, notReadyObligations: input.admission.notReadyObligations, details: input.admission.details }; }
}
