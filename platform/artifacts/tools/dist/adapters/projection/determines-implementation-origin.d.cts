interface OriginObligation {
    readonly language: string;
    readonly binding: {
        readonly implementationId: string;
    };
}
type ImplementationOrigin = {
    readonly origin: "UNKNOWN";
    readonly reason: string;
} | {
    readonly origin: "MIXED" | "PROJECTED" | "HAND_AUTHORED";
    readonly projectedCount: number;
    readonly handWrittenCount: number;
};
declare function determineImplementationOrigin(obligation: OriginObligation): ImplementationOrigin;
declare const _default: {
    determineImplementationOrigin: typeof determineImplementationOrigin;
};
export = _default;
