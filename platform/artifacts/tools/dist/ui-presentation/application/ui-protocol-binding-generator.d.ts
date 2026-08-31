type Digest = `sha256:${string}`;
export interface GeneratedProtocolBinding {
    readonly language: string;
    readonly relativePath: string;
    readonly content: string;
}
export declare function bindingModelDigest(value: object): Digest;
export declare function generateUiProtocolBindings(repositoryRoot: string): readonly GeneratedProtocolBinding[];
export declare function writeUiProtocolBindings(repositoryRoot: string): readonly GeneratedProtocolBinding[];
export {};
