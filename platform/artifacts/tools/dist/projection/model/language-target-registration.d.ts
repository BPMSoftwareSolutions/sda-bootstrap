import type { ProjectionTarget, StructuralProjectionProfile } from "./projection-profile.js";
export type ProviderRole = "structuralRenderer" | "executionRenderer" | "shapeObserver" | "sourceMechanicObserver" | "toolchainDriver";
export type ProviderTransport = "builtin" | "process-json-v1";
export interface RegisteredTargetProvider {
    readonly providerId: string;
    readonly transport: ProviderTransport;
    readonly implementationRef: string;
    readonly implementationDigest: string;
    readonly operation?: string;
    readonly authorityRef?: string;
    readonly authorityDigest?: string;
}
export interface LanguageTargetRegistration {
    readonly registrationType: "language-target-registration.v1";
    readonly targetId: ProjectionTarget;
    readonly displayName: string;
    readonly status: "DECLARED" | "IMPLEMENTING";
    readonly bindingRef: string;
    readonly projectionProfileRef: string;
    readonly toolchainProfileRef: string;
    readonly admittedStructuralSource: {
        readonly directory: string;
        readonly extensions: readonly string[];
        readonly excludedFiles?: readonly string[];
    };
    readonly promotion: {
        readonly structuralOutputDirectory: string;
        readonly structuralProfileOverrides?: Partial<StructuralProjectionProfile>;
        readonly preserveExistingStructuralFiles: boolean;
        readonly managedExtensions: readonly string[];
    };
    readonly providers: Readonly<Partial<Record<ProviderRole, RegisteredTargetProvider>> & Pick<Record<ProviderRole, RegisteredTargetProvider>, "structuralRenderer" | "executionRenderer" | "shapeObserver">>;
    readonly supportedContracts: Readonly<Record<string, string>>;
}
export interface ToolchainStepProfile {
    readonly command: string;
    readonly args: readonly string[];
    readonly workingDirectory?: "repository" | "target";
    readonly ensureDirectories?: readonly string[];
    readonly timeoutMs?: number;
}
export interface ToolchainOperationProfile {
    readonly description?: string;
    readonly steps: readonly ToolchainStepProfile[];
}
export interface TargetToolchainProfile {
    readonly profileType: "target-toolchain-profile.v1";
    readonly targetId: ProjectionTarget;
    readonly driver: "legacy-built-in" | "argv.v1";
    readonly languageStandard?: string;
    readonly operations: Readonly<Partial<Record<"availability" | "structural" | "execution" | "behavior" | "consumer" | "ui", ToolchainOperationProfile>>>;
}
