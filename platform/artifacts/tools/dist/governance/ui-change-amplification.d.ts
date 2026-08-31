export type UiChangeClass = "CONSUMER_UI_DATA_ONLY" | "UI_RECIPE_DATA_ONLY" | "UI_PROTOCOL_EVOLUTION" | "TARGET_PROVIDER_EVOLUTION" | "CONSUMER_DOMAIN_EVOLUTION";
export interface UiChangeDeclaration {
    readonly declarationType: "sda-ui-change-declaration.v1";
    readonly changeClass: UiChangeClass;
    readonly description: string;
    readonly targets: readonly string[];
}
export interface UiChangeAmplificationPolicy {
    readonly policyType: "sda-ui-change-amplification-policy.v1";
    readonly declarationRef: string;
    readonly relevantPrefixes: readonly string[];
    readonly classes: readonly {
        readonly changeClass: UiChangeClass;
        readonly allowedPrefixes: readonly string[];
    }[];
}
export interface UiChangeAmplificationEvidence {
    readonly evidenceType: "sda-ui-change-amplification-evidence.v1";
    readonly changeClass: UiChangeClass | null;
    readonly relevantPaths: readonly string[];
    readonly unexpectedPaths: readonly string[];
    readonly disposition: "PASS" | "NOT_APPLICABLE" | "CHANGE_AMPLIFICATION_VIOLATION";
}
export declare function evaluateUiChangeAmplification(policy: UiChangeAmplificationPolicy, declaration: UiChangeDeclaration | null, changedPaths: readonly string[]): UiChangeAmplificationEvidence;
