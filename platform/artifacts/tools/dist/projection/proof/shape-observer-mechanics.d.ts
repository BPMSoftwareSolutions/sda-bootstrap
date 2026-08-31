import type { ShapeEvidence } from "../model/shape-evidence.js";
export interface NamedShape {
    readonly description: string;
}
export declare function compareNamedShapes(admitted: ReadonlyMap<string, NamedShape>, projected: ReadonlyMap<string, NamedShape>): ShapeEvidence;
