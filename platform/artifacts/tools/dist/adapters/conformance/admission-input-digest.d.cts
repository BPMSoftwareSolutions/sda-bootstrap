interface Obligation {
    readonly language: string;
    readonly bindingPath?: string;
    readonly binding: Record<string, unknown> & {
        readonly implementationId: string;
    };
}
interface Artifact {
    readonly proofInputDigest?: string;
}
declare function stable(value: unknown): unknown;
declare function computeAdmissionInputDigest(repositoryRoot: string, obligation: Obligation): string;
declare function admissionArtifactIsCurrent(repositoryRoot: string, obligation: Obligation, artifact: Artifact | null | undefined): boolean;
declare const _default: {
    computeAdmissionInputDigest: typeof computeAdmissionInputDigest;
    admissionArtifactIsCurrent: typeof admissionArtifactIsCurrent;
    stable: typeof stable;
};
export = _default;
