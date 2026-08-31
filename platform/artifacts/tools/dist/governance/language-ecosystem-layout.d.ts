export declare const LANGUAGE_ECOSYSTEMS: readonly ["cpp", "csharp", "go", "java", "kotlin", "python", "swift", "typescript"];
export declare const OWNED_IMPLEMENTATION_ROOTS: Readonly<{
    readonly node: "languages/typescript/runtimes/node";
    readonly browser: "languages/typescript/runtimes/browser";
    readonly react: "languages/typescript/presentation/react";
    readonly "browser-dom": "languages/typescript/presentation/browser-dom";
    readonly javafx: "languages/java/presentation/javafx";
    readonly swiftui: "languages/swift/presentation/swiftui";
    readonly "android-compose": "languages/kotlin/presentation/android-compose";
}>;
export interface LanguageEcosystemLayoutFinding {
    readonly code: "NON_LANGUAGE_ROOT" | "LANGUAGE_ECOSYSTEM_MISSING" | "OWNED_IMPLEMENTATION_MISSING";
    readonly path: string;
    readonly owner?: string;
}
export interface LanguageEcosystemLayoutEvidence {
    readonly evidenceType: "language-ecosystem-layout-evidence.v1";
    readonly languageRoots: readonly string[];
    readonly findings: readonly LanguageEcosystemLayoutFinding[];
    readonly disposition: "PASS" | "FAIL";
}
export declare function inspectLanguageEcosystemLayout(repositoryRoot: string): LanguageEcosystemLayoutEvidence;
