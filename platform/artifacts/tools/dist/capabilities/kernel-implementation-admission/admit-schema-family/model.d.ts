import type { SourceFact } from "../../../model/semantic-model.js";
export interface SchemaFamilyAdmissionInput {
    readonly schemasDirectory: string;
    readonly schemaFiles: readonly SourceFact<Record<string, unknown>>[];
    readonly unresolved: SourceFact<readonly string[]>;
}
export interface SchemaFamilyAdmissionEvidence {
    readonly files: readonly string[];
    readonly unresolved: readonly string[];
    readonly valid: boolean;
}
export declare const isSchemaFamilyAdmissionInput: (value: unknown) => value is SchemaFamilyAdmissionInput;
export declare const isSchemaFamilyAdmissionEvidence: (value: unknown) => value is SchemaFamilyAdmissionEvidence;
