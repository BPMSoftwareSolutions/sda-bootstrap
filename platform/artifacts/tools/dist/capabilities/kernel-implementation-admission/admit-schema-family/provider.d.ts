import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { SchemaFamilyAdmissionEvidence, SchemaFamilyAdmissionInput } from "./model.js";
export declare class SchemaFamilyAdmissionProvider implements ResponsibilityProvider<SchemaFamilyAdmissionInput, SchemaFamilyAdmissionEvidence> {
    readonly responsibilityId = "compile-and-resolve-canonical-schema-family";
    execute(input: SchemaFamilyAdmissionInput): Promise<SchemaFamilyAdmissionEvidence>;
}
