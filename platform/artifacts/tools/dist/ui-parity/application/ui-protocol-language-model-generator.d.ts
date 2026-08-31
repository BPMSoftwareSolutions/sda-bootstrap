export interface GeneratedUiProtocolLanguageModel {
    readonly relativePath: string;
    readonly content: string;
}
export declare function generateUiProtocolLanguageModels(repositoryRoot: string): readonly GeneratedUiProtocolLanguageModel[];
