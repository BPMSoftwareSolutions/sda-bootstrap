export class SchemaFamilyAdmissionObligation {
    obligationId = "every-canonical-schema-and-reference-resolves-under-the-declared-dialect";
    evaluate(evidence) {
        const satisfied = evidence.valid && evidence.files.length > 0;
        return { kind: satisfied ? "SATISFIED" : "NOT_SATISFIED", conditionEvidence: [{ conditionId: "schema-family-compiles-with-no-unresolved-reference", disposition: satisfied ? "SATISFIED" : "NOT_SATISFIED", detail: `${evidence.files.length} schema(s), ${evidence.unresolved.length} unresolved` }] };
    }
}
