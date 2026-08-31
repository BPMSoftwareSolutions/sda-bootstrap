import type { JsonRecord } from "../../consumer-projection/model/consumer-workspace-facts.js";
export declare const UI_FILE_SOURCE_TYPE = "ui-file-source-envelope.v1";
export declare const MAX_SOURCE_BYTES: number;
export interface FileSourceEnvelope extends JsonRecord {
    readonly fileName: string;
    readonly mediaType: string;
    readonly contentBase64: string;
}
export declare function parsedFileSourceEnvelope(sourceValue: unknown): {
    readonly candidate: boolean;
    readonly envelope?: FileSourceEnvelope;
};
export declare function decodedFileSourceBytes(envelope: FileSourceEnvelope): Buffer | null;
