export class SchemaFamilyAdmissionProvider {
    responsibilityId = "compile-and-resolve-canonical-schema-family";
    async execute(input) {
        const files = input.schemaFiles.map((fact) => fact.sourceRef.split(/[\\/]/).at(-1) ?? fact.sourceRef).sort();
        return { files, unresolved: input.unresolved.value, valid: input.unresolved.value.length === 0 };
    }
}
