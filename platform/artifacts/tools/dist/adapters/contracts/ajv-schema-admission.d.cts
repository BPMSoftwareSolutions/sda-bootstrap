import type { SchemaAdmissionPort, SchemaAdmissionResult } from "../../ports/conformance/schema-admission.js";
export declare class AjvSchemaAdmission implements SchemaAdmissionPort {
    private readonly schemasDirectory;
    private validator;
    constructor(schemasDirectory: string);
    listSchemaFiles(): readonly string[];
    validate(instance: unknown, schemaFilename: string): SchemaAdmissionResult;
    unresolvedSchemaFiles(): readonly string[];
    private createValidator;
}
