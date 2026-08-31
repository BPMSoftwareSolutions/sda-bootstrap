import type { LanguageTargetRegistration, ProviderRole, RegisteredTargetProvider, TargetToolchainProfile } from "../../projection/model/language-target-registration.js";
import type { ProjectionTarget } from "../../projection/model/projection-profile.js";
export declare function repositoryTextDigest(content: string | Buffer): string;
export declare class NodeLanguageTargetRegistry {
    private readonly repositoryRoot;
    constructor(repositoryRoot: string);
    private entries;
    discover(): readonly LanguageTargetRegistration[];
    targets(): readonly ProjectionTarget[];
    registration(target: ProjectionTarget): LanguageTargetRegistration;
    targetPath(target: ProjectionTarget, relativeReference: string): string;
    targetRoot(target: ProjectionTarget): string;
    repositoryPath(relativeReference: string): string;
    verifiedProvider(target: ProjectionTarget, role: ProviderRole): RegisteredTargetProvider;
    toolchainProfile(target: ProjectionTarget): TargetToolchainProfile;
}
