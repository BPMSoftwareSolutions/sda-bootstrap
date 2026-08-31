export type StrictJsonErrorCode = "JSON_DUPLICATE_KEY" | "JSON_PARSE_ERROR";
export declare class StrictJsonError extends Error {
    readonly code: StrictJsonErrorCode;
    readonly characterOffset: number;
    readonly byteOffset: number;
    constructor(code: StrictJsonErrorCode, message: string, source: string, characterOffset: number);
}
export declare function parseStrictJson(source: string, maximumDepth: number): unknown;
