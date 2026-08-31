import type { JsonRecord } from "../../consumer-projection/model/consumer-workspace-facts.js";
export interface UiPresentationCompilationEvidence extends JsonRecord {
    readonly evidenceType: "sda-ui-presentation-compilation-evidence.v1";
    readonly compilerId: "sda-ui-presentation-compiler.v2";
    readonly sourceAuthorityType: "consumer-ui-authority.v1";
    readonly sourceAuthorityDigest: `sha256:${string}`;
    readonly presentationIrType: "sda-ui-presentation-ir.v2";
    readonly protocolSchemaDigest: `sha256:${string}`;
    readonly presentationIrDigest: `sha256:${string}`;
    readonly requiredFeatureIds: readonly string[];
    readonly disposition: "COMPILED";
}
export interface UiPresentationCompilation {
    readonly ir: JsonRecord;
    readonly evidence: UiPresentationCompilationEvidence;
}
export declare class UiPresentationCompiler {
    private readonly repositoryRoot;
    private readonly identity;
    constructor(repositoryRoot: string);
    compile(authority: JsonRecord): UiPresentationCompilation;
}
