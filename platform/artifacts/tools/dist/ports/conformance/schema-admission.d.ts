export interface SchemaAdmissionError {
    readonly instancePath: string;
    readonly message: string;
}
export interface SchemaAdmissionResult {
    readonly valid: boolean;
    readonly errors: readonly SchemaAdmissionError[];
}
export interface SchemaAdmissionPort {
    listSchemaFiles(): readonly string[];
    validate(instance: unknown, schemaFilename: string): SchemaAdmissionResult;
    unresolvedSchemaFiles(): readonly string[];
}
