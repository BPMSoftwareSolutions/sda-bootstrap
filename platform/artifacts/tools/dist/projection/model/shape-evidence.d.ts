export interface ShapeMatchResult {
    readonly typeName: string;
    readonly status: "MATCH" | "MISMATCH" | "HAND_WRITTEN_ONLY" | "GENERATED_ONLY";
    readonly detail?: string;
}
export interface ShapeEvidence {
    readonly results: readonly ShapeMatchResult[];
    readonly matchCount: number;
    readonly totalCount: number;
}
